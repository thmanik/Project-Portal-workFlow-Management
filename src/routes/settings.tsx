import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { type PortalSettings, usePortal } from "@/lib/portal-data";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [{ title: "Settings — Project Portal" }],
  }),
});

type ListKey = "categories" | "workRequestTypes" | "projectInfoCategories";

const defaultLists: Record<ListKey, string[]> = {
  categories: ["Client Request", "Engineering", "General"],
  workRequestTypes: [
    "Stowage Plan",
    "Voyage Condition",
    "Mooring Plan",
    "Mooring Analysis",
    "Grillade & Sea-Fastening Plan",
    "Berthing Feasibility",
    "Loadout Feasibility",
    "Motion Analysis",
  ],
  projectInfoCategories: ["Cargo Info", "Port Info", "SPMT Info", "Vessel info", "General info"],
};

const listMeta: Record<
  ListKey,
  {
    title: string;
    addLabel: string;
  }
> = {
  categories: {
    title: "Attachment Categories",
    addLabel: "Add Category",
  },
  workRequestTypes: {
    title: "Work Request Types",
    addLabel: "Add Work Type",
  },
  projectInfoCategories: {
    title: "Project Info Categories",
    addLabel: "Add Info Category",
  },
};

function uniqueList(values: string[]) {
  const seen = new Set<string>();

  return values
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
}

function SettingsPage() {
  const { state, currentActor, updateSettings } = usePortal();
  const [portalName, setPortalName] = useState(state.settings.portalName);
  const [activeAddList, setActiveAddList] = useState<ListKey | null>(null);
  const [newItem, setNewItem] = useState("");
  const canManage = ["system_admin", "prime_consultant"].includes(currentActor.role);

  const getList = (key: ListKey) => {
    const value = state.settings[key];

    if (Array.isArray(value) && value.length) {
      return value;
    }

    return defaultLists[key];
  };

  const updateList = (key: ListKey, value: string[]) => {
    updateSettings({ [key]: uniqueList(value) } as Partial<PortalSettings>);
  };

  const addItem = () => {
    if (!activeAddList) return;

    const value = newItem.trim();
    if (!value) return;

    const currentList = getList(activeAddList);
    if (currentList.some((item) => item.toLowerCase() === value.toLowerCase())) {
      toast.error("This item already exists");
      return;
    }

    updateList(activeAddList, [...currentList, value]);
    toast.success("Item added");
    setNewItem("");
    setActiveAddList(null);
  };

  const removeItem = (key: ListKey, item: string) => {
    const currentList = getList(key);

    updateList(
      key,
      currentList.filter((value) => value !== item)
    );

    toast.success("Item removed");
  };

  const resetList = (key: ListKey) => {
    updateList(key, defaultLists[key]);
    toast.success("Default list restored");
  };

  const saveGeneralSettings = () => {
    const name = portalName.trim();

    if (!name) {
      toast.error("Portal name is required");
      return;
    }

    updateSettings({ portalName: name });
    toast.success("Settings saved");
  };

  const renderListCard = (key: ListKey) => {
    const meta = listMeta[key];
    const list = getList(key);

    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-sm font-semibold text-card-foreground">{meta.title}</h3>

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setActiveAddList(key)}>
                <Plus className="h-4 w-4" />
                {meta.addLabel}
              </Button>

              <Button variant="outline" size="sm" onClick={() => resetList(key)}>
                Reset
              </Button>
            </div>
          ) : null}
        </div>

        {list.length ? (
          <div className="flex flex-wrap gap-2">
            {list.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
              >
                {item}

                {canManage ? (
                  <button
                    type="button"
                    className="cursor-pointer rounded hover:text-destructive"
                    onClick={() => removeItem(key, item)}
                    aria-label={`Remove ${item}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No items configured yet.</p>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="Settings" />

      <div className="max-w-5xl space-y-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-sm font-semibold text-card-foreground">General</h3>

            {canManage ? (
              <Button onClick={saveGeneralSettings}>
                <Save className="h-4 w-4" />
                Save
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Portal Name</label>
            <input
              value={portalName}
              onChange={(event) => setPortalName(event.target.value)}
              disabled={!canManage}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>
        </div>

        {renderListCard("workRequestTypes")}
        {renderListCard("projectInfoCategories")}
        {renderListCard("categories")}
      </div>

      <Dialog
        open={!!activeAddList}
        onOpenChange={(open) => {
          if (!open) {
            setActiveAddList(null);
            setNewItem("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeAddList ? listMeta[activeAddList].addLabel : "Add Item"}</DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <input
              value={newItem}
              onChange={(event) => setNewItem(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addItem();
              }}
              placeholder="Type item name"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActiveAddList(null);
                setNewItem("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={addItem}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
