import Modal from "../Modal";
import ModalDetails from "../ModalDetails";
import { formatDate, formatNumbers } from "../../utils";

export default function SubscriptionDetailsModal({ isOpen, onClose, data }) {
  if (!data) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Subscription Details"
      subtitle="Plan and billing overview"
    >
      <ModalDetails
        data={[
          { label: "Business", value: data.business_name || "-" },
          { label: "Plan", value: data.plan || "-" },
          { label: "Status", value: data.status || "-" },
          { label: "Price", value: formatNumbers(data.plan_details?.price || 0, 0) },
          { label: "Start Date", value: formatDate(data.startsAt, "dd MMM yyyy") },
          { label: "Expiry", value: formatDate(data.expiresAt, "dd MMM yyyy") },
          { label: "Active", value: data.active ? "Yes" : "No" },
        ]}
      />
    </Modal>
  );
}
