import React, { useEffect, useMemo, useState } from "react";
import { Keyboard, Pencil } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { useShortcutActions, useShortcutMap } from "../hooks/useShortcuts";
import {
  SHORTCUT_ACTIONS,
  findActionByShortcut,
  formatComboDisplay,
  formatShortcutFromEvent,
  getActionLabel,
} from "../utils/shortcuts";
import { useToast } from "../context/ToastContext";

function EditShortcutModal({
  isOpen,
  onClose,
  action,
  currentShortcut,
  allShortcuts,
  onSave,
}) {
  const [capturedCombo, setCapturedCombo] = useState("");
  const [capturedDisplay, setCapturedDisplay] = useState("");
  const [isModifierOnlyCapture, setIsModifierOnlyCapture] = useState(false);
  const [error, setError] = useState("");

  const conflictAction = useMemo(() => {
    if (!capturedCombo) return null;
    return findActionByShortcut(allShortcuts, capturedCombo, action?.id);
  }, [allShortcuts, capturedCombo, action?.id]);

  useEffect(() => {
    if (!isOpen) return;
    setCapturedCombo(currentShortcut || "");
    setCapturedDisplay(formatComboDisplay(currentShortcut || ""));
    setIsModifierOnlyCapture(false);
    setError("");
  }, [isOpen, currentShortcut]);

  useEffect(() => {
    if (!isOpen) return;

    const handleCapture = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        onClose();
        return;
      }

      const parsed = formatShortcutFromEvent(e);
      setCapturedCombo(parsed.combo);
      setCapturedDisplay(parsed.display || "Press keys...");
      setIsModifierOnlyCapture(parsed.isModifierOnly);

      if (parsed.isModifierOnly) {
        setError("Ctrl, Shift, and Alt cannot be assigned alone.");
        return;
      }

      setError("");
    };

    const hardBlock = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("keydown", handleCapture, true);
    document.addEventListener("keydown", hardBlock, true);
    return () => {
      window.removeEventListener("keydown", handleCapture, true);
      document.removeEventListener("keydown", hardBlock, true);
    };
  }, [isOpen, onClose]);

  if (!action) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit: ${action.label}`}
      subtitle="Press the shortcut you want to assign"
      maxWidth="max-w-xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" outline onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(capturedCombo)} disabled={!capturedCombo || isModifierOnlyCapture}>
            Save Shortcut
          </Button>
        </div>
      }
    >
      <div data-shortcut-capture="true" className="grid gap-4">
        <div className="rounded-2xl border border-gray-300 bg-gray-50 p-4">
          <p className="text-xs text-gray-500 mb-2">Current Shortcut</p>
          <p className="text-sm font-medium text-gray-800">{formatComboDisplay(currentShortcut)}</p>
        </div>

        <div className="rounded-2xl border border-teal-300 bg-teal-50 p-4">
          <p className="text-xs text-teal-700 mb-2">New Shortcut</p>
          <p className="text-lg font-semibold text-teal-800">{capturedDisplay || "Press keys..."}</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {conflictAction && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Already assigned to "{conflictAction.label}". Saving will remove it from that action.
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function KeyboardShortcuts() {
  const { showToast } = useToast();
  const { assignShortcut } = useShortcutActions();
  const shortcuts = useShortcutMap();

  const [editingAction, setEditingAction] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const openEdit = (action) => {
    setEditingAction(action);
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditingAction(null);
  };

  const handleSaveShortcut = async (combo) => {
    if (!editingAction || !combo) return;

    const { removedFromActionId } = await assignShortcut(editingAction.id, combo);
    const savedLabel = formatComboDisplay(combo);

    if (removedFromActionId) {
      showToast({
        type: "warning",
        message: `Saved ${savedLabel}. Removed from ${getActionLabel(removedFromActionId)}.`,
      });
    } else {
      showToast({ type: "success", message: `Saved ${savedLabel} for ${editingAction.label}.` });
    }

    closeEdit();
  };

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader
          title="Keyboard Shortcuts"
          subtitle="View and customize action shortcuts across the app."
        />

        <div className="rounded-3xl bg-white border border-gray-300 overflow-hidden">
          <div className="flex items-center gap-3 px-7 py-5 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-100 border border-gray-200">
              <Keyboard size={17} className="text-gray-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Shortcut Assignments</h2>
              <p className="text-xs text-gray-400 mt-0.5">Press Edit to capture a new shortcut.</p>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {SHORTCUT_ACTIONS.map((action) => (
              <div key={action.id} className="flex items-center justify-between px-6 py-4 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-800">{action.label}</p>
                  <p className="text-xs text-gray-500">{action.description}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 min-w-36 text-center">
                    {formatComboDisplay(shortcuts[action.id])}
                  </span>
                  <Button variant="secondary" outline icon={Pencil} size="sm" onClick={() => openEdit(action)}>
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <EditShortcutModal
        isOpen={isEditOpen}
        onClose={closeEdit}
        action={editingAction}
        currentShortcut={editingAction ? shortcuts[editingAction.id] : ""}
        allShortcuts={shortcuts}
        onSave={handleSaveShortcut}
      />
    </>
  );
}
