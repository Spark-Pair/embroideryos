import { useEffect, useState } from "react";
import { ImageUp, Save, Trash2, X } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });
}

export default function InvoiceBannerModal({
  isOpen,
  onClose,
  initialBanner = "",
  onSave,
}) {
  const [bannerData, setBannerData] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setBannerData(initialBanner || "");
    setError("");
  }, [isOpen, initialBanner]);

  const handlePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Banner size should be less than 5MB.");
      return;
    }

    try {
      const data = await readFileAsDataUrl(file);
      setBannerData(data);
      setError("");
    } catch {
      setError("Failed to read selected file.");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(bannerData);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save banner");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Invoice Banner"
      subtitle="Upload a full-width banner for invoice header"
      maxWidth="max-w-3xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <p className="text-xs text-red-600">{error}</p>
          <div className="flex gap-2">
            <Button variant="secondary" outline icon={X} onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="secondary" outline icon={Trash2} onClick={() => setBannerData("")} disabled={saving}>
              Remove
            </Button>
            <Button icon={Save} onClick={handleSave} loading={saving}>
              Save Banner
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 p-0.5">
        <div>
          <label className="block mb-1.5 text-sm text-gray-700">Upload Banner</label>
          <input
            type="file"
            accept="image/*"
            onChange={handlePick}
            className="block w-full text-sm text-gray-700 file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border file:border-gray-300 file:bg-gray-50 file:cursor-pointer"
          />
        </div>

        {bannerData ? (
          <div className="rounded-xl border border-gray-300 bg-white p-2">
            <img
              src={bannerData}
              alt="Invoice banner preview"
              className="w-full max-h-56 object-cover rounded-lg"
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-10 flex flex-col items-center justify-center text-gray-400">
            <ImageUp className="h-6 w-6 mb-2" />
            <p className="text-sm">No banner selected</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
