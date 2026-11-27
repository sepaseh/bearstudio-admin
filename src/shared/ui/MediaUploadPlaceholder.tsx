import { Button, Card } from "antd";
import { Plus } from "lucide-react";
import type { AriaAttributes, ReactElement } from "react";

type MediaUploadPlaceholderProps = AriaAttributes & {
  disabled?: boolean;
  label: string;
  onSelect: () => void;
  status?: ReactElement | null;
};

const frame = { minHeight: 104, width: "100%" };

export const MediaUploadPlaceholder = ({
  disabled,
  label,
  onSelect,
  status,
  ...aria
}: MediaUploadPlaceholderProps) => {
  if (status) {
    return (
      <Card
        aria-label={label}
        role="group"
        size="small"
        style={{
          ...frame,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
        styles={{ body: { padding: 8 } }}
      >
        {status}
      </Card>
    );
  }

  return (
    <Button
      {...aria}
      aria-label={label}
      disabled={disabled}
      icon={<Plus aria-hidden color="currentColor" size={24} />}
      onClick={onSelect}
      style={{ ...frame, height: "auto" }}
      type="dashed"
    />
  );
};
