
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import {
  isValidPassword,
  getPasswordRequirements, 
} from "@/lib/validation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const requirements = getPasswordRequirements(newPassword);

  useEffect(() => {
    let active = true;

    async function checkRecovery() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { error } =
          await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          if (active) setMessage("رابط الاسترجاع غير صالح أو انتهت صلاحيته.");
          return;
        }

        window.history.replaceState({}, "", "/reset-password");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (active) {
        if (user) {
          setReady(true);
        } else {
          setMessage("افتحي رابط الاسترجاع المرسل إلى بريدك الإلكتروني.");
        }
      }
    }

    void checkRecovery();

    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleReset() {
    setMessage("");

    if (!isValidPassword(newPassword)) {
      setMessage("كلمة المرور لا تستوفي الشروط المطلوبة.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.auth.signOut();
    alert("تم تغيير كلمة المرور بنجاح. سجلي دخولك بالكلمة الجديدة.");
    router.replace("/login");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md sm:p-8">
      <h1 className="font-heading text-2xl font-bold">
        إعادة تعيين كلمة المرور
      </h1>

      <p className="mt-2 text-sm text-navy-900/70">
        أدخلي كلمة المرور الجديدة لتحديث حسابك.
      </p>

      {ready && (
        <div className="mt-6 flex flex-col gap-5">
          <Input
            label="كلمة المرور الجديدة"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <div className="flex flex-col gap-1 text-xs">
            <p className={requirements.minLength ? "text-success-500" : "text-navy-900/60"}>
              {requirements.minLength ? "✓" : "○"} الحد الأدنى للطول
            </p>
            <p className={requirements.hasNumber ? "text-success-500" : "text-navy-900/60"}>
              {requirements.hasNumber ? "✓" : "○"} تحتوي على رقم
            </p>
            <p className={requirements.hasUppercase ? "text-success-500" : "text-navy-900/60"}>
              {requirements.hasUppercase ? "✓" : "○"} تحتوي على حرف كبير
            </p>
          </div>

          <Input
            label="تأكيد كلمة المرور"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <Button
            type="button"
            fullWidth
            disabled={loading}
            onClick={handleReset}
          >
            {loading ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
          </Button>
        </div>
      )}

      {message && (
        <p role="alert" className="mt-4 text-sm text-danger-500">
          {message}
        </p>
      )}

      <p className="mt-6 text-center text-sm">
        <Link
          href="/login"
          className="font-semibold text-gold-700 underline"
        >
          العودة لتسجيل الدخول
        </Link>
      </p>
    </Card>
  );
}
