"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { LocalBadge } from "@/components/ui/local-badge";
import { useAdminCatalogueStore } from "@/store/admin-catalogue-store";
import type { CategoryRow } from "@/types/admin";
import { useAdminProducts } from "../hooks/use-admin-products";
import { AdminPage } from "./admin-page";
import { AdminError, AdminSkeleton } from "./admin-states";

function CategoryItem({ row, onRename }: { row: CategoryRow; onRename: (slug: string, name: string) => string | null }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.name);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = onRename(row.slug, name);
    setError(problem);
    if (!problem) setEditing(false);
  }

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 p-4">
      {editing ? (
        <form onSubmit={submit} className="flex flex-wrap items-start gap-2">
          <FormField label={`Name for ${row.slug}`} value={name} onChange={(event) => { setName(event.target.value); setError(null); }} error={error ?? undefined} />
          <div className="flex gap-2 pt-6">
            <Button type="submit" size="sm">Save name (local)</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(false); setName(row.name); setError(null); }}>Cancel</Button>
          </div>
        </form>
      ) : (
        <>
          <div className="min-w-0">
            <p className="font-medium">
              {row.name}
              {row.renamed ? <span className="ml-2 text-xs font-normal text-muted-foreground">(renamed locally)</span> : null}
              {row.local ? <span className="ml-2 text-xs font-normal text-muted-foreground">(created locally)</span> : null}
            </p>
            <p className="text-sm text-muted-foreground">{`${row.slug} · ${row.productCount} ${row.productCount === 1 ? "product" : "products"}`}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Rename<span className="sr-only">{` ${row.name}`}</span>
          </Button>
        </>
      )}
    </li>
  );
}

/** Category management (PRD 8.2): create and rename categories locally; assign them from a product's edit form. */
export function CategoriesView() {
  const { loading, error, retry, categories } = useAdminProducts();
  const addCategory = useAdminCatalogueStore((state) => state.addCategory);
  const renameCategory = useAdminCatalogueStore((state) => state.renameCategory);
  const [name, setName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = addCategory(name, categories);
    if (result.ok) {
      setNotice(`Category "${name.trim()}" created locally (simulation). Assign products to it from a product's edit page.`);
      setName("");
      setAddError(null);
    } else {
      setAddError(result.error);
    }
  }

  return (
    <AdminPage
      title="Categories"
      description="Create and rename categories. Renaming changes the display name in the admin screens only; products keep their category. Assign a product to a category on its edit page."
      actions={<LocalBadge />}
    >
      {loading ? (
        <AdminSkeleton label="Loading categories" />
      ) : error ? (
        <AdminError error={error} onRetry={retry} />
      ) : (
        <>
          <form onSubmit={handleAdd} noValidate aria-label="Add a category" className="flex max-w-xl flex-wrap items-start gap-3">
            <div className="min-w-56 flex-1">
              <FormField label="New category name" value={name} onChange={(event) => { setName(event.target.value); setAddError(null); }} error={addError ?? undefined} />
            </div>
            <Button type="submit" className="mt-6">Add category (local)</Button>
          </form>
          <p role="status" className="min-h-5 text-sm font-medium text-primary">{notice}</p>

          <ul aria-label="Categories" className="divide-y rounded-xl border bg-card shadow-surface">
            {categories.map((row) => (
              <CategoryItem
                key={row.slug}
                row={row}
                onRename={(slug, newName) => {
                  const result = renameCategory(slug, newName, categories);
                  if (result.ok) {
                    setNotice(`Category renamed to "${newName.trim()}" (local simulation).`);
                    return null;
                  }
                  return result.error;
                }}
              />
            ))}
          </ul>
        </>
      )}
    </AdminPage>
  );
}
