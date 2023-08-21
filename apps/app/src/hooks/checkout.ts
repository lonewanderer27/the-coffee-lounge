import {
  DeliveryOptionType,
  DeliveryStatusType,
  OrderType,
  PaymentOptionType,
  PaymentStatusType,
} from "../types";
import {
  Timestamp,
  addDoc,
  collection,
  getFirestore,
  serverTimestamp,
} from "firebase/firestore";
import {
  branchAtom,
  deliverAddressChoiceAtom,
  deliverOptionAtom,
  payOptionAtom,
} from "../atoms/checkout";
import { useIonAlert, useIonLoading, useIonRouter } from "@ionic/react";
import { useRecoilState, useSetRecoilState } from "recoil";

import { OrderConvert } from "../converters/orders";
import { cartAtom } from "../atoms/cart";
import { getAuth } from "firebase/auth";
import { orderAtom } from "../atoms/order";

const paymentGatewayURL = (
  paymentOption: PaymentOptionType,
  amountDue: number,
  orderId: string,
) => {
  const baseURL = import.meta.env.VITE_PAYMENT_GATEWAY_URL;
  const callbackUrl = `${window.location.origin}/orders/${orderId}/payment-success`;
  switch (paymentOption) {
    case PaymentOptionType.GCash: {
      return `${baseURL}/gcash/login?amountDue=${amountDue}.00&merchant=The Coffee Lounge&callbackUrl=${callbackUrl}`;
    }
    default: {
      return `${baseURL}/gcash/login?amountDue=${amountDue}.00&merchant=The Coffee Lounge&callbackUrl=${callbackUrl}`;
    }
  }
}

export const useCheckout = (totalPrice: number) => {
  const [cart, setCart] = useRecoilState(cartAtom);
  const [payOption, setPayOption] = useRecoilState(payOptionAtom);
  const [deliverOption, setDeliverOption] = useRecoilState(deliverOptionAtom);
  const [deliverAddress, setDeliverAddress] = useRecoilState(
    deliverAddressChoiceAtom
  );
  const [branchOption, setbranchOption] = useRecoilState(branchAtom);
  const setOrderAtom = useSetRecoilState(orderAtom);
  const router = useIonRouter();
  const db = getFirestore();
  const { currentUser } = getAuth();
  const [presentLoading, dismiss] = useIonLoading();

  const [showAlert, hideAlert] = useIonAlert();

  function addOrder() {
    if (!currentUser) {
      router.push("/login");
      return;
    }

    (async () => {
      // create the order document for the user
      presentLoading("Adding order...");

      let newOrder: OrderType = {
        user_uid: currentUser?.uid,
        products: cart,
        total_price: totalPrice,
        payment_option: payOption!,
        payment_status: PaymentStatusType.Pending,
        payment_at: serverTimestamp() as Timestamp,
        created_at: serverTimestamp() as Timestamp,
        delivery_option: deliverOption!,
        delivery_status: DeliveryStatusType.Pending,
        branch: branchOption!,
      };

      if (deliverOption === DeliveryOptionType.Delivery) {
        newOrder = {
          ...newOrder,
          delivery_address_id: deliverAddress?.id!,
        };
      }

      (async () => {
        try {
          const order = (
            await addDoc(collection(db, "orders"), newOrder)
          ).withConverter(OrderConvert);

          console.log("Success adding order: ", order);

          // clear the cart
          setCart([]);
          setPayOption(null);
          setDeliverOption(null);
          setDeliverAddress(null);
          setbranchOption(null);

          // set the current order in the atom
          setOrderAtom(newOrder);

          // dismiss loading
          await dismiss();

          // redirect to payment gateway
          window.location.replace(
            paymentGatewayURL(payOption!, totalPrice, order.id)
          );
        } catch {
          // dismiss loading
          await dismiss();

          showAlert({
            header: "Error",
            message:
              "There was an error adding your order. Would you like to try again?",
            buttons: [
              "Cancel",
              { text: "Try Again", handler: () => addOrder() },
            ],
            onDidDismiss: () => hideAlert(),
          });
        }
      })();
    })();
  }

  return {
    handlePay: addOrder,
  };
};
