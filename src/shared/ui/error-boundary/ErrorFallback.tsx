import { Button, Result } from "antd";
import { useTranslation } from "react-i18next";

type ErrorFallbackProps = {
  onRetry?: () => void | Promise<void>;
};

const reloadPage = () => window.location.reload();

export const ErrorFallback = ({ onRetry }: ErrorFallbackProps) => {
  const { t } = useTranslation();
  const recover = onRetry ?? reloadPage;
  const message = t("unexpectedError");

  return (
    <Result
      extra={
        <Button onClick={() => void recover()} type="primary">
          {t(onRetry ? "retry" : "reload")}
        </Button>
      }
      status="500"
      subTitle={onRetry ? <span role="alert">{message}</span> : message}
      title="500"
    />
  );
};
