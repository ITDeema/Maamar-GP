"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import { useT } from "@/lib/i18n";
import { isValidEmail } from "@/lib/validation";

export default function LoginPage() {
  const { t, setLang } = useT();
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const emailError = isValidEmail(email) ? undefined : t("error.emailInvalid");
  const passwordError = password === "" ? t("error.passwordRequired") : undefined;

  
 async function handleSubmit(event: FormEvent) {
   event.preventDefault();
   setSubmitted(true);

   if (emailError || passwordError) return;

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
   });

    if (error) {
  console.error("Supabase Login Error:", error);
  alert(error.message);
  return;
}

   // Get the user's saved language from Supabase
const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("preferredLanguage, deletion_requested_at")
  .eq("userID", authData.user.id)
  .single();

// Cancel pending account deletion when the user logs in.
if (profileError) {
  await supabase.auth.signOut();
  alert("Unable to check account status. Please try again.");
  return;
}

if (profile?.deletion_requested_at) {
  const { data: cancelled, error: cancelError } = await supabase
    .rpc("cancel_pending_account_deletion");

  if (cancelError || cancelled !== true) {
    await supabase.auth.signOut();
    alert("The account deletion grace period has expired.");
    return;
  }

  alert("Your account deletion has been cancelled.");
}

if (
  profile?.preferredLanguage === "ar" ||
  profile?.preferredLanguage === "en"
) {
  setLang(profile.preferredLanguage);
}

router.push("/home");
router.refresh();
 }


  return (
    <Card className="w-full max-w-md sm:p-8">
      <h1 className="font-heading text-2xl font-bold">{t("login.title")}</h1>
      <p className="mt-2 text-sm text-navy-900/70">{t("login.subtitle")}</p>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-6 flex flex-col gap-5"
      >
        <Input
          label={t("common.email")}
          type="email"
          dir="ltr"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={submitted ? emailError : undefined}
        />
        <Input
          label={t("common.password")}
          type="password"
          dir="ltr"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={submitted ? passwordError : undefined}
        />

        <Link
          href="/forgot-password"
          className="self-end text-sm text-navy-900/70 underline hover:text-navy-900"
        >
          {t("login.forgot")}
        </Link>

        <Button type="submit" fullWidth>
          {t("login.submit")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-navy-900/70">
        {t("login.noAccount")}{" "}
        <Link href="/signup" className="font-semibold text-gold-700 underline">
          {t("login.toSignup")}
        </Link>
      </p>
    </Card>
  );
}