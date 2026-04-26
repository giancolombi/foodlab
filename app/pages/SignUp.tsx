import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SignUp() {
  const { signUp } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t("signup.passwordTooShort"));
      return;
    }
    setSubmitting(true);
    try {
      await signUp(email, password, displayName || undefined);
      navigate("/profiles");
    } catch (err: any) {
      toast.error(err.message ?? t("signup.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <LanguagePicker />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("signup.title")}</CardTitle>
          <CardDescription>{t("signup.subtitle")}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="displayName">{t("signup.displayName")}</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("signup.displayNameOptional")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("signin.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("signin.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("signup.passwordHint")}
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3 items-stretch">
            <Button type="submit" disabled={submitting}>
              {submitting ? t("signup.submitting") : t("signup.submit")}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              {t("signup.haveAccount")}{" "}
              <Link to="/signin" className="text-primary hover:underline">
                {t("signup.signin")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
