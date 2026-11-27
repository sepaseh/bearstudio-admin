import { Card, ConfigProvider, Tooltip } from "antd";
import { createStyles } from "antd-style";
import { Repeat2, Trash2 } from "lucide-react";
import type {
  AriaAttributes,
  CSSProperties,
  ReactElement,
  ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

type MediaUploadCardProps = AriaAttributes & {
  cover: ReactNode;
  disabled?: boolean;
  label: string;
  onRemove?: () => void;
  onReplace: () => void;
  replaceLabel: string;
  status?: ReactElement | null;
};

const cardTheme = { components: { Card: { actionsLiMargin: "0" } } };
const fullWidthCardStyle = { maxWidth: "100%", width: "100%" };

export const mediaUploadPreviewStyle = {
  display: "block",
  height: 144,
  objectFit: "contain",
  width: "100%",
} satisfies CSSProperties;

const useStyles = createStyles(({ css, token }) => ({
  action: css`
    align-items: center;
    display: flex;
    justify-content: center;
    min-height: 28px;
    width: 100%;

    &:focus-visible {
      outline: 2px solid ${token.colorPrimary};
      outline-offset: -2px;
    }

    &[aria-disabled="true"] {
      color: ${token.colorTextDisabled};
      cursor: not-allowed;
    }
  `,
}));

type MediaActionProps = AriaAttributes & {
  disabled?: boolean;
  fieldLabel: string;
  icon: ReactElement;
  label: string;
  onActivate: () => void;
};

const MediaAction = ({
  disabled,
  fieldLabel,
  icon,
  label,
  onActivate,
  ...aria
}: MediaActionProps) => {
  const { styles } = useStyles();
  const activate = () => {
    if (!disabled) onActivate();
  };

  return (
    <Tooltip title={label} trigger={["hover", "focus"]}>
      <span
        {...aria}
        aria-disabled={disabled || undefined}
        aria-label={`${label} · ${fieldLabel}`}
        className={styles.action}
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (event.key === "Enter" && !event.repeat) activate();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " ") activate();
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
      >
        {icon}
      </span>
    </Tooltip>
  );
};

export const MediaUploadCard = ({
  cover,
  disabled,
  label,
  onRemove,
  onReplace,
  replaceLabel,
  status,
  ...aria
}: MediaUploadCardProps) => {
  const { t } = useTranslation();
  const actions = [
    <MediaAction
      key="primary"
      {...aria}
      disabled={disabled}
      fieldLabel={label}
      icon={<Repeat2 aria-hidden color="currentColor" size={16} />}
      label={replaceLabel}
      onActivate={onReplace}
    />,
  ];

  if (onRemove) {
    actions.push(
      <MediaAction
        key="remove"
        disabled={disabled}
        fieldLabel={label}
        icon={<Trash2 aria-hidden color="currentColor" size={16} />}
        label={t("remove")}
        onActivate={onRemove}
      />,
    );
  }

  return (
    <ConfigProvider theme={cardTheme}>
      <Card
        actions={status ? undefined : actions}
        aria-label={label}
        cover={cover}
        role="group"
        size="small"
        style={fullWidthCardStyle}
        styles={{ cover: { margin: 0, padding: 4 } }}
      >
        {status}
      </Card>
    </ConfigProvider>
  );
};
