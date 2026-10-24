
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import SegmentedControl from "@/components/SegmentedControl";
import { useT } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { mockUser } from "@/lib/user";
import {
  isValidEmail,
  isValidPassword,
  getPasswordRequirements,
} from "@/lib/validation";

type Dialog = "logout" | "delete" | "changePassword" | null;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-navy-900/70">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  );
}

export default function ProfilePage() {
  const { t, lang, setLang } = useT();
  const router = useRouter();
  const supabase = createClient();

  const [dialog, setDialog] = useState<Dialog>(null);
  const [deletePassword, setDeletePassword] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [passwordError, setPasswordError] = useState("");

  const [editingAccount, setEditingAccount] = useState(false);

  const [accountEmail, setAccountEmail] = useState(mockUser.email);
  const [accountRole, setAccountRole] = useState(mockUser.role);

  const [draftEmail, setDraftEmail] = useState(mockUser.email);
  const [draftRole, setDraftRole] = useState(mockUser.role);
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("userID", user.id)
        .single();

      if (profileError) {
        console.error("Profile error:", profileError.message);
      }

      const realEmail = user.email ?? "";

      setAccountEmail(realEmail);
      setDraftEmail(realEmail);

      if (profile?.role === "homeowner" || profile?.role === "architect") {
        setAccountRole(profile.role);
        setDraftRole(profile.role);
      }
    }

    void loadProfile();
  }, [router, supabase]);

  async function changeLanguage(newLang: Lang) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("يرجى تسجيل الدخول مرة أخرى.");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ preferredLanguage: newLang })
      .eq("userID", user.id)
      .select("preferredLanguage")
      .single();

    if (error || !data) {
      alert("تعذر حفظ اللغة، حاولي مرة أخرى.");
      console.error("Language update error:", error);
      return;
    }

    setLang(newLang);
  }

  async function saveAccount() {
    if (!isValidEmail(draftEmail.trim())) {
      setEmailError(t("error.emailInvalid"));
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setEmailError("يرجى تسجيل الدخول مرة أخرى.");
      return;
    }

    // Save the account type in profiles
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ role: draftRole })
      .eq("userID", user.id);

    if (profileError) {
      setEmailError(profileError.message);
      return;
    }

    // Update email through Supabase Auth
    if (draftEmail.trim() !== user.email) {
      const { error: authError } =
        await supabase.auth.updateUser({
          email: draftEmail.trim(),
        });

      if (authError) {
        setEmailError(authError.message);
        return;
      }

      alert("تم طلب تغيير البريد الإلكتروني. تحققي من رسائل التأكيد.");
    }

    setAccountRole(draftRole);
    setAccountEmail(user.email ?? "");
    setEmailError("");
    setEditingAccount(false);
  }

  
async function validatePasswordChange() {
  if (!currentPassword || !newPassword || !confirmPassword) {
    setPasswordError(t("profile.passwordFieldsRequired"));
    return;
  }

  if (!isValidPassword(newPassword)) {
    setPasswordError(t("error.passwordRequirements"));
    return;
  }

  if (newPassword !== confirmPassword) {
    setPasswordError(t("profile.passwordMismatch"));
    return;
  }

  if (newPassword === currentPassword) {
    setPasswordError(t("profile.passwordUnchanged"));
    return;
  }

  // Verify the current password
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    setPasswordError("يرجى تسجيل الدخول مرة أخرى.");
    return;
  }

  const { error: verifyError } =
    await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });  

  if (verifyError) {
    setPasswordError("كلمة المرور الحالية غير صحيحة.");
    return;
  }

  // Update the password
  const { error: updateError } =
    await supabase.auth.updateUser({
      password: newPassword,
    });

  if (updateError) {
    setPasswordError(updateError.message);
    return;
  }

  closeDialog();
  alert("تم تغيير كلمة المرور بنجاح.");
}


  function closeDialog() {
    setDialog(null);
    setDeletePassword("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert("تعذر تسجيل الخروج، حاولي مرة أخرى.");
      return;
    }

    closeDialog();
    router.push("/login");
    router.refresh();
  }

  function deleteAccount() {
    // TODO: call the delete-account API with the password.
    closeDialog();
    router.push("/login");
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-8">

      <div className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-pill border border-navy-900/15 bg-navy-50"
        >
          <svg
            className="h-9 w-9 text-navy-900"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        </div>

        <div className="flex flex-col items-start gap-1">
          <h1 className="font-heading text-xl font-bold">
            {t("profile.myAccount")}
          </h1>
          <Badge>{t(`role.${mockUser.role}`)}</Badge>
        </div>
      </div>

      <Card>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold">
            {t("profile.accountInfo")}
          </h2>

          <Button
            variant="secondary"

            onClick={() => {
              setDraftEmail(accountEmail);
              setDraftRole(accountRole);
              setEditingAccount(true);
            }}

          >
            {t("profile.editAccount")}
          </Button>
        </div>

        <dl className="flex flex-col gap-4">

          {editingAccount ? (
            <div className="flex flex-col gap-4">
              <Input
                label={t("common.email")}
                type="email"
                dir="ltr"
                autoComplete="email"
                value={draftEmail}
                onChange={(e) => setDraftEmail(e.target.value)}
                error={emailError || undefined}
              />

              <SegmentedControl
                label={t("common.accountType")}

                value={draftRole}
                onChange={setDraftRole}

                options={[
                  { value: "homeowner", label: t("role.homeowner") },
                  { value: "architect", label: t("role.architect") },
                ]}
              />

              <div className="flex flex-wrap gap-3">

                <Button onClick={saveAccount}>
                  {t("common.save")}
                </Button>

                <Button
                  variant="secondary"

                  onClick={() => {
                    setDraftEmail(accountEmail);
                    setDraftRole(accountRole);
                    setEditingAccount(false);
                  }}

                >
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <dl className="flex flex-col gap-4">
              <InfoRow
                label={t("common.email")}
                value={accountEmail}
              />
              <InfoRow
                label={t("common.accountType")}
                value={t(`role.${accountRole}`)}
              />
            </dl>
          )}

        </dl>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-bold">{t("profile.settings")}</h2>
        <div className="max-w-xs">
          <SegmentedControl<Lang>
            label={t("profile.language")}
            value={lang}
            onChange={changeLanguage}
            options={[
              { value: "ar", label: "العربية" },
              { value: "en", label: "English" },
            ]}
          />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-bold">{t("profile.manage")}</h2>
        <div className="flex flex-wrap gap-3">

          <Button
            variant="secondary"
            onClick={() => setDialog("changePassword")}
          >
            {t("profile.changePassword")}
          </Button>

          <Button variant="secondary" onClick={() => setDialog("logout")}>
            {t("profile.logout")}
          </Button>
          <Button variant="danger" onClick={() => setDialog("delete")}>
            {t("profile.delete")}
          </Button>
        </div>
      </Card>

      <Modal
        open={dialog === "changePassword"}
        onClose={closeDialog}
        title={t("profile.changePassword")}
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t("profile.currentPassword")}
            type="password"
            dir="ltr"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />

          <Input
            label={t("profile.newPassword")}
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <div className="flex flex-col gap-1 text-xs">
            {(
              [
                ["minLength", "signup.passwordMinLength"],
                ["hasNumber", "signup.passwordNumber"],
                ["hasUppercase", "signup.passwordUppercase"],
              ] as const
            ).map(([key, label]) => {
              const met = getPasswordRequirements(newPassword)[key];

              return (
                <p
                  key={key}
                  className={met ? "text-success-500" : "text-navy-900/60"}
                >
                  <span aria-hidden="true">{met ? "✓" : "○"}</span>{" "}
                  {t(label)}
                </p>
              );
            })}
          </div>

          <Input
            label={t("profile.confirmPassword")}
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {passwordError && (
            <p role="alert" className="text-sm text-danger-500">
              {passwordError}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-3">

            <Button onClick={validatePasswordChange}>
              {t("profile.validatePassword")}
            </Button>

            <Button variant="secondary" onClick={closeDialog}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={dialog === "logout"}
        onClose={closeDialog}
        title={t("profile.logout")}
      >
        <p className="text-sm text-navy-900/70">{t("profile.logoutBody")}</p>
        <div className="mt-6 flex gap-3">
          <Button onClick={logout}>{t("profile.logout")}</Button>
          <Button variant="secondary" onClick={closeDialog}>
            {t("common.cancel")}
          </Button>
        </div>
      </Modal>

      <Modal
        open={dialog === "delete"}
        onClose={closeDialog}
        title={t("profile.delete")}
      >
        <p className="text-sm text-navy-900/70">{t("profile.deleteWarning")}</p>
        <div className="mt-4">
          <Input
            label={t("common.password")}
            type="password"
            dir="ltr"
            autoComplete="current-password"
            autoFocus
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
          />
          <p className="mt-2 text-xs text-navy-900/70">
            {t("profile.deleteConfirm")}
          </p>
        </div>
        <div className="mt-6 flex gap-3">
          <Button
            variant="danger"
            disabled={deletePassword === ""}
            onClick={deleteAccount}
          >
            {t("profile.delete")}
          </Button>
          <Button variant="secondary" onClick={closeDialog}>
            {t("common.cancel")}
          </Button>
        </div>
      </Modal>
    </main>
  );
}
