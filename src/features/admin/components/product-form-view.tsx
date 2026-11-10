"use client";

import Link from "next/link";
import { PackageX } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ProductImage } from "@/features/products";
import { formatInr } from "@/lib/currency";
import { useAdminCatalogueStore } from "@/store/admin-catalogue-store";
import { productToDraft } from "@/utils/admin-catalogue";
import { StockBadge } from "./stock-badge";
import { useAdminProducts } from "../hooks/use-admin-products";
import { AdminPage } from "./admin-page";
import { AdminError, AdminSkeleton } from "./admin-states";
import { ProductForm } from "./product-form";

/** Add a product (PRD 8.2). It is created in local state only. */
export function NewProductView() {
  const { loading, error, retry, categories } = useAdminProducts();
  const create = useAdminCatalogueStore((state) => state.create);
  const [created, setCreated] = useState<{ id: number; title: string } | null>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <AdminPage title="Add product" description="Create a product in local state. It appears in the admin lists only, not on the storefront.">
      {loading ? (
        <AdminSkeleton label="Loading the form" />
      ) : error ? (
        <AdminError error={error} onRetry={retry} />
      ) : (
        <>
          {created ? (
            <div role="status" className="max-w-3xl rounded-xl border border-primary/40 bg-accent p-4 text-sm text-accent-foreground">
              <p className="font-medium">{`"${created.title}" was created locally (simulation).`}</p>
              <p className="mt-1">
                <Link href={`/admin/products/${created.id}`} className="underline underline-offset-4">Open it</Link>
                {" or "}
                <Link href="/admin/products" className="underline underline-offset-4">go back to the product list</Link>.
              </p>
            </div>
          ) : null}
          <ProductForm
            key={formKey}
            initial={productToDraft()}
            categories={categories}
            submitLabel="Create product (local)"
            onSubmit={(values) => {
              setCreated({ id: create(values), title: values.title });
              setFormKey((key) => key + 1);
            }}
          />
        </>
      )}
    </AdminPage>
  );
}

function NotFound() {
  return (
    <AdminPage title="Product not found">
      <div className="flex flex-col items-start gap-3 rounded-xl border bg-card shadow-surface p-6">
        <PackageX aria-hidden="true" className="size-8 text-muted-foreground" />
        <p className="max-w-md text-muted-foreground">There is no product with that id in the catalogue or among your local products.</p>
        <Button asChild>
          <Link href="/admin/products">Back to products</Link>
        </Button>
      </div>
    </AdminPage>
  );
}

/** Product detail and edit view (PRD 8.2). */
export function EditProductView({ productId }: { productId: string }) {
  const { loading, error, retry, products, categories, referenced } = useAdminProducts();
  const save = useAdminCatalogueStore((state) => state.save);
  const revert = useAdminCatalogueStore((state) => state.revert);
  const remove = useAdminCatalogueStore((state) => state.remove);
  const restore = useAdminCatalogueStore((state) => state.restore);
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // A locally created product disappears completely when deleted, so its confirmation is kept here.
  const [removedTitle, setRemovedTitle] = useState<string | null>(null);

  const id = /^[1-9][0-9]{0,9}$/.test(productId) ? Number(productId) : null;
  const product = id === null ? undefined : products.find((candidate) => candidate.id === id);

  if (loading) return <AdminPage title="Product"><AdminSkeleton label="Loading the product" /></AdminPage>;
  if (error) return <AdminPage title="Product"><AdminError error={error} onRetry={retry} /></AdminPage>;
  if (!product && removedTitle !== null) {
    return (
      <AdminPage title="Product removed">
        <div role="status" className="max-w-xl space-y-3 rounded-xl border bg-card shadow-surface p-6">
          <p>{`"${removedTitle}" was removed (local simulation).`}</p>
          <Button asChild>
            <Link href="/admin/products">Back to products</Link>
          </Button>
        </div>
      </AdminPage>
    );
  }
  if (!product) return <NotFound />;

  return (
    <AdminPage
      title={product.title}
      description={
        <>
          {`Product #${product.id} · ${product.origin === "local" ? "created locally" : "from the product API"} · `}
          <span className="capitalize">{product.status}</span>
          {product.edited ? " · edited locally" : ""}
        </>
      }
      actions={
        <Button asChild variant="outline">
          <Link href="/admin/products">Back to products</Link>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted">
            <ProductImage src={product.thumbnail} sizes="14rem" alt={product.title} />
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Price now</dt><dd>{formatInr(product.finalPrice)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Rating</dt><dd>{product.rating > 0 ? product.rating.toFixed(1) : "None"}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-muted-foreground">Stock</dt><dd><StockBadge availability={product.availability} /></dd></div>
          </dl>
          {product.origin === "catalogue" && product.status === "active" ? (
            <Link href={`/products/${product.id}`} className="text-sm text-primary underline-offset-4 hover:underline">View on the storefront</Link>
          ) : null}
          {referenced.has(product.id) ? <p className="text-xs text-muted-foreground">Existing orders include this product, so it can be archived but never lost from order history.</p> : null}
        </aside>

        <div className="space-y-4">
          <p role="status" className="min-h-5 text-sm font-medium text-primary">{notice}</p>
          <ProductForm
            key={`${product.id}-${formKey}`}
            initial={productToDraft(product)}
            categories={categories}
            submitLabel="Save changes (local)"
            onSubmit={(values) => {
              save(product, values);
              setNotice("Saved locally (simulation). The storefront is unchanged.");
            }}
          >
            {product.edited && product.origin === "catalogue" ? (
              <Button type="button" variant="outline" onClick={() => { revert(product.id); setFormKey((key) => key + 1); setNotice("Local edits were discarded; the product shows its catalogue values again."); }}>
                Discard local edits
              </Button>
            ) : null}
            {product.status !== "active" ? (
              <Button type="button" variant="outline" onClick={() => { restore(product.id); setNotice("Product restored (local simulation)."); }}>
                Restore product
              </Button>
            ) : confirming ? (
              <span role="group" aria-label="Confirm deleting this product" className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setConfirming(false);
                    const outcome = remove(product, referenced);
                    if (outcome === "removed") setRemovedTitle(product.title);
                    setNotice(outcome === "archived" ? "This product is in existing orders, so it was archived instead of deleted to keep order history intact (local simulation)." : "Product removed (local simulation).");
                  }}
                >
                  Confirm delete
                </Button>
                <Button type="button" variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
              </span>
            ) : (
              <Button type="button" variant="outline" onClick={() => setConfirming(true)}>Delete product</Button>
            )}
          </ProductForm>
          <p className="text-xs text-muted-foreground">Images are not editable in this simulation.</p>
        </div>
      </div>
    </AdminPage>
  );
}

