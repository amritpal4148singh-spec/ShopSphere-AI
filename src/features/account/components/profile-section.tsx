"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { fileToAvatar } from "@/lib/avatar";
import { useProfileStore } from "@/store/profile-store";
import { cleanProfile, profilesEqual, validateProfile, type ProfileValues } from "@/utils/profile";
import { hasErrors, type FieldErrors } from "@/utils/validation";
import { useProfile } from "../hooks/use-profile";
import { Avatar } from "./avatar";

type Errors = FieldErrors<"name" | "email" | "phone">;

/** Profile (PRD 5.7): name, contact email, phone and avatar, edited and saved on this device only. */
export function ProfileSection() {
  const { ready, values } = useProfile();
  const [draft, setDraft] = useState<ProfileValues | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const avatarErrorId = useId();

  const savedKey = values ? JSON.stringify(values) : "";
  useEffect(() => {
    if (values) setDraft(values);
    // Reset the form only when the stored profile itself changes (first load, save, another tab).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  if (!ready || !values || !draft) {
    return (
      <section aria-labelledby={headingId} className="rounded-xl border bg-card p-6 shadow-surface" aria-busy="true">
        <h2 id={headingId} className="section-title">
          Profile
        </h2>
        <div className="mt-4 h-40 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      </section>
    );
  }

  const dirty = !profilesEqual(cleanProfile(draft), values);

  function setField(field: "name" | "email" | "phone", value: string) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
    setNotice(null);
  }

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = await fileToAvatar(file);
    if (!result.ok) {
      setAvatarError(result.message);
      return;
    }
    setAvatarError(null);
    setNotice(null);
    setDraft((current) => (current ? { ...current, avatar: result.dataUrl } : current));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const found = validateProfile(draft);
    setErrors(found);
    if (hasErrors(found)) {
      setNotice({ kind: "error", text: "Fix the highlighted fields and try again." });
      return;
    }
    const result = useProfileStore.getState().save(draft);
    if (result.ok) setNotice({ kind: "success", text: "Profile saved on this device." });
    else if ("errors" in result) setErrors(result.errors);
    else setNotice({ kind: "error", text: result.reason === "storage" ? "Your browser would not save the profile. Check that storage is allowed and try again." : "Sign in again to save your profile." });
  }

  function cancel() {
    setDraft(values);
    setErrors({});
    setAvatarError(null);
    setNotice(null);
  }

  return (
    <section aria-labelledby={headingId} className="rounded-xl border bg-card p-4 shadow-surface sm:p-6">
      <h2 id={headingId} className="section-title">
        Profile
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Saved on this device only (local demonstration). Your sign-in email stays the same; the email below is your contact email.
      </p>

      <form noValidate onSubmit={handleSubmit} className="mt-5 grid gap-6 md:grid-cols-[auto_1fr]" aria-describedby={notice ? "profile-notice" : undefined}>
        <div className="flex flex-col items-start gap-3">
          <Avatar name={draft.name || values.name} src={draft.avatar} className="size-24" />
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Choose profile picture" aria-describedby={avatarError ? avatarErrorId : undefined} onChange={(event) => void chooseAvatar(event)} tabIndex={-1} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              {draft.avatar ? "Change picture" : "Add picture"}
            </Button>
            {draft.avatar ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setDraft({ ...draft, avatar: null })}>
                Remove
              </Button>
            ) : null}
          </div>
          {avatarError ? (
            <p id={avatarErrorId} role="alert" className="max-w-48 text-sm text-destructive">
              {avatarError}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name" name="name" autoComplete="name" value={draft.name} error={errors.name} onChange={(event) => setField("name", event.target.value)} />
          <FormField label="Contact email" name="email" type="email" autoComplete="email" value={draft.email} error={errors.email} onChange={(event) => setField("email", event.target.value)} />
          <FormField label="Mobile number (optional)" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={draft.phone} error={errors.phone} hint="10 digits, for delivery updates." onChange={(event) => setField("phone", event.target.value)} />

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={!dirty}>
              Save profile
            </Button>
            {dirty || avatarError ? (
              <Button type="button" variant="outline" onClick={cancel}>
                Cancel
              </Button>
            ) : null}
            {notice ? (
              <p id="profile-notice" role={notice.kind === "error" ? "alert" : "status"} className={notice.kind === "error" ? "text-sm font-medium text-destructive" : "text-sm font-medium text-success"}>
                {notice.text}
              </p>
            ) : null}
          </div>
        </div>
      </form>
    </section>
  );
}
