"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import { useT } from "@/lib/i18n";
import { isValidEmail } from "@/lib/validation";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const { t } = useT();
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const emailError = isValidEmail(email) ? undefined : t("error.emailInvalid");

  
async function handleSubmit(event: FormEvent) {
  event.preventDefault();
  setSubmitted(true);

  if (emailError) return;

  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim(),
    {
      redirectTo: `${window.location.origin}/reset-password`,
    }
  );

  if (error) {
    console.error("Password reset error:", error.message);
    alert("تعذر إرسال رابط الاسترجاع. حاول مرة أخرى لاحقًا.");
    return;
  }

  alert(
    "إذا كان البريد مسجلًا، ستصلك رسالة تحتوي على رابط إعادة تعيين كلمة المرور."
  );
}


  return (
    <Card className="w-full max-w-md sm:p-8">
      <h1 className="font-heading text-2xl font-bold">{t("forgot.title")}</h1>
      <p className="mt-2 text-sm text-navy-900/70">{t("forgot.subtitle")}</p>

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
        <Button type="submit" fullWidth>
          {t("forgot.submit")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-gold-700 underline">
          {t("forgot.back")}
        </Link>
      </p>
    </Card>
  );
}