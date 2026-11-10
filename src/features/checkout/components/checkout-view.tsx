
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/features/auth";
import { useCartData } from "@/features/cart";
import { simulatePayment } from "@/services/checkout/payment";
import { useAddressStore } from "@/store/address-store";
import { useCartStore } from "@/store/cart-store";
import { useCheckoutStore } from "@/store/checkout-store";
import { useOrdersStore } from "@/store/orders-store";
import { hasErrors } from "@/utils/validation";
import {
  computeCheckoutTotals,
  emptyDraft,
  generateOrderId,
  isAddressComplete,
  isCustomerComplete,
  validatePayment,
} from "@/utils/checkout";
import { buildOrder } from "@/utils/orders";
import type { CheckoutStep } from "@/types/checkout";
import { AddressStep } from "./address-step";
import {
  CartNeedsAttention,
  CheckoutSkeleton,
  EmptyCheckout,
  PlacingOrder,
} from "./checkout-states";
import { CustomerStep } from "./customer-step";
import { DeliveryStep } from "./delivery-step";
import { OrderSummaryPanel } from "./order-summary-panel";
import { PaymentStep } from "./payment-step";
import { StepIndicator } from "./step-indicator";
import { SummaryStep } from "./summary-step";

export function CheckoutView() {
  const router = useRouter();
  const { user } = useAuth();
  const cart = useCartData();
  const clearCart = useCartStore((state) => state.clear);

  const checkoutStatus = useCheckoutStore((state) => state.status);
  const ownerId = useCheckoutStore((state) => state.ownerId);
  const draft = useCheckoutStore((state) => state.draft);
  const initDraft = useCheckoutStore((state) => state.init);
  const updateDraft = useCheckoutStore((state) => state.update);
  const resetDraft = useCheckoutStore((state) => state.reset);

  const addressStatus = useAddressStore((state) => state.status);
  const savedAddresses = useAddressStore((state) => state.addresses);
  const saveAddress = useAddressStore((state) => state.add);

  const ordersStatus = useOrdersStore((state) => state.status);
  const addOrder = useOrdersStore((state) => state.addOrder);

  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [showPaymentErrors, setShowPaymentErrors] = useState(false);

  const placingRef = useRef(false);
  const placedRef = useRef(false);
  const stepRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (
      checkoutStatus === "ready" &&
      ownerId &&
      !draft &&
      user &&
      !placedRef.current
    ) {
      initDraft(emptyDraft({ name: user.name, email: user.email }));
    }
  }, [checkoutStatus, ownerId, draft, user, initDraft]);

  const stepForFocus = draft?.step;

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    stepRef.current?.focus();
  }, [stepForFocus]);

  const ready =
    cart.status === "ready" &&
    checkoutStatus === "ready" &&
    addressStatus === "ready" &&
    ordersStatus === "ready" &&
    draft !== null;

  if (!ready || !draft) return <CheckoutSkeleton />;
  if (placed) return <PlacingOrder />;
  if (cart.lines.length === 0) return <EmptyCheckout />;
  if (cart.blockers.length > 0) {
    return <CartNeedsAttention blockers={cart.blockers} />;
  }

  const lines = cart.lines.filter((line) => line.status === "ok");
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const totals = computeCheckoutTotals(
    cart.totals.subtotal,
    cart.couponCode,
    draft.deliveryId,
  );

  let step: CheckoutStep = draft.step;

  if (step >= 2 && !isCustomerComplete(draft.customer)) step = 1;
  if (step >= 3 && !isAddressComplete(draft.address)) step = 2;

  const goTo = (target: CheckoutStep) => updateDraft({ step: target });
  const next = () => goTo(Math.min(step + 1, 5) as CheckoutStep);
  const back = () => goTo(Math.max(step - 1, 1) as CheckoutStep);

  async function placeOrder() {
    if (!draft || placingRef.current || placedRef.current) return;

    setShowPaymentErrors(true);

    if (
      hasErrors(validatePayment(draft.payment, totals.total)) ||
      draft.payment.method === null
    ) {
      return;
    }

    placingRef.current = true;
    setPlacing(true);
    setFailure(null);

    try {
      const result = await simulatePayment(draft.payment);

      if (!result.ok) {
        setFailure(result.message);
        return;
      }

      const order = buildOrder({
        id: generateOrderId(),
        now: Date.now(),
        items: lines.map((line) => ({
          productId: line.item.productId,
          title: line.item.title,
          thumbnail: line.item.thumbnail,
          variantLabel: line.item.variantLabel,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        })),
        customer: draft.customer,
        address: draft.address,
        deliveryId: draft.deliveryId,
        paymentMethod:
          draft.payment.method as NonNullable<
            typeof draft.payment.method
          >,
        couponCode: cart.couponCode,
      });

      if (
        draft.address.saveAddress &&
        draft.address.savedAddressId === null
      ) {
        saveAddress(draft.address);
      }

      addOrder(order);
      placedRef.current = true;
      setPlaced(true);

      clearCart();
      resetDraft();

      router.replace(`/checkout/confirmation/${order.id}`);
    } catch (error) {
      console.error("Checkout failed:", error);
      setFailure("We could not place your order. Please try again.");
      placedRef.current = false;
    } finally {
      setPlacing(false);
      placingRef.current = false;
    }
  }

  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="page-title">Checkout</h1>

      <div className="mt-4">
        <StepIndicator
          current={step}
          maxStep={draft.maxStep}
          onSelect={goTo}
        />
      </div>

      {cart.catalog.isError ? (
        <p
          role="status"
          className="mt-4 rounded-md border bg-accent px-4 py-3 text-sm"
        >
          We could not re-check the latest prices and stock just now. Your
          order will use the prices shown here.
        </p>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div ref={stepRef} tabIndex={-1} className="min-w-0 outline-none">
          {step === 1 ? (
            <CustomerStep
              customer={draft.customer}
              onChange={(customer) => updateDraft({ customer })}
              onNext={next}
            />
          ) : null}

          {step === 2 ? (
            <AddressStep
              address={draft.address}
              savedAddresses={savedAddresses}
              onChange={(address) => updateDraft({ address })}
              onBack={back}
              onNext={next}
            />
          ) : null}

          {step === 3 ? (
            <DeliveryStep
              deliveryId={draft.deliveryId}
              subtotal={cart.totals.subtotal}
              couponCode={cart.couponCode}
              onChange={(deliveryId) => updateDraft({ deliveryId })}
              onBack={back}
              onNext={next}
            />
          ) : null}

          {step === 4 ? (
            <SummaryStep
              draft={draft}
              lines={lines}
              onEdit={goTo}
              onBack={back}
              onNext={next}
            />
          ) : null}

          {step === 5 ? (
            <PaymentStep
              payment={draft.payment}
              total={totals.total}
              placing={placing}
              failure={failure}
              showErrors={showPaymentErrors}
              onChange={(payment) => updateDraft({ payment })}
              onDismissFailure={() => setFailure(null)}
              onBack={back}
              onPlaceOrder={() => void placeOrder()}
            />
          ) : null}
        </div>

        <OrderSummaryPanel totals={totals} itemCount={itemCount} />
      </div>
    </section>
  );
}
