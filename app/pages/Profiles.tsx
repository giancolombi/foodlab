import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Textarea,
} from "@/design-system";
import { User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import type { Profile } from "@/types";

interface ProfileFormState {
  id?: string;
  name: string;
  restrictions: string;
  preferences: string;
  allergies: string;
  notes: string;
}

const EMPTY: ProfileFormState = {
  name: "",
  restrictions: "",
  preferences: "",
  allergies: "",
  notes: "",
};

function toList(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fromProfile(p: Profile): ProfileFormState {
  return {
    id: p.id,
    name: p.name,
    restrictions: p.restrictions.join(", "),
    preferences: p.preferences.join(", "),
    allergies: p.allergies.join(", "),
    notes: p.notes ?? "",
  };
}

export default function Profiles() {
  const { t } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<ProfileFormState | null>(null);

  const refresh = async () => {
    const { profiles } = await api<{ profiles: Profile[] }>("/profiles");
    setProfiles(profiles);
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const payload = {
      name: editing.name.trim(),
      restrictions: toList(editing.restrictions),
      preferences: toList(editing.preferences),
      allergies: toList(editing.allergies),
      notes: editing.notes.trim() || undefined,
    };
    if (!payload.name) {
      toast.error(t("profiles.nameRequired"));
      return;
    }
    try {
      if (editing.id) {
        await api(`/profiles/${editing.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success(t("profiles.updated"));
      } else {
        await api("/profiles", { method: "POST", body: payload });
        toast.success(t("profiles.created"));
      }
      setEditing(null);
      await refresh();
    } catch (err: any) {
      toast.error(err.message ?? t("profiles.saveFailed"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("profiles.confirmDelete"))) return;
    try {
      await api(`/profiles/${id}`, { method: "DELETE" });
      await refresh();
    } catch (err: any) {
      toast.error(err.message ?? t("profiles.deleteFailed"));
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
      <PageHeader
        title={t("profiles.title")}
        subtitle={t("profiles.subtitle")}
        actions={
          !editing ? (
            <Button onClick={() => setEditing({ ...EMPTY })}>
              <Plus className="h-4 w-4" /> {t("profiles.new")}
            </Button>
          ) : undefined
        }
      />

      {editing && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {editing.id
                  ? t("profiles.editTitle")
                  : t("profiles.newTitle")}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditing(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">{t("profiles.name")}</Label>
                <Input
                  id="name"
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="restrictions">
                  {t("profiles.restrictions")}
                </Label>
                <Input
                  id="restrictions"
                  placeholder={t("profiles.restrictionsPlaceholder")}
                  value={editing.restrictions}
                  onChange={(e) =>
                    setEditing({ ...editing, restrictions: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="allergies">{t("profiles.allergies")}</Label>
                <Input
                  id="allergies"
                  placeholder={t("profiles.allergiesPlaceholder")}
                  value={editing.allergies}
                  onChange={(e) =>
                    setEditing({ ...editing, allergies: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preferences">
                  {t("profiles.preferences")}
                </Label>
                <Input
                  id="preferences"
                  placeholder={t("profiles.preferencesPlaceholder")}
                  value={editing.preferences}
                  onChange={(e) =>
                    setEditing({ ...editing, preferences: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">{t("profiles.notes")}</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder={t("profiles.notesPlaceholder")}
                  value={editing.notes}
                  onChange={(e) =>
                    setEditing({ ...editing, notes: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">{t("profiles.save")}</Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditing(null)}
                >
                  {t("profiles.cancel")}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {profiles.map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{p.name}</CardTitle>
                  {p.restrictions.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {p.restrictions.join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 sm:gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(fromProfile(p))}
                    aria-label={t("profiles.editTitle")}
                    className="h-11 w-11 sm:h-9 sm:w-9"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(p.id)}
                    aria-label={t("profiles.confirmDelete")}
                    className="h-11 w-11 sm:h-9 sm:w-9"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              {p.allergies.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">
                    {t("profiles.allergiesLabel")}
                  </span>{" "}
                  {p.allergies.map((a) => (
                    <Badge key={a} variant="outline" className="mr-1">
                      {a}
                    </Badge>
                  ))}
                </div>
              )}
              {p.preferences.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">
                    {t("profiles.preferencesLabel")}
                  </span>{" "}
                  {p.preferences.join(", ")}
                </div>
              )}
              {p.notes && (
                <p className="text-muted-foreground">{p.notes}</p>
              )}
            </CardContent>
          </Card>
        ))}
        {!editing && profiles.length === 0 && (
          <EmptyState
            icon={User}
            title={t("profiles.empty")}
            action={
              <Button onClick={() => setEditing({ ...EMPTY })}>
                <Plus className="h-4 w-4" /> {t("profiles.new")}
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
