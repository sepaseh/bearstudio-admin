import {
  Alert,
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Flex,
  Form,
  Input,
  Layout,
  Modal,
  Spin,
  Tooltip,
  Typography,
} from "antd";
import { useResponsive } from "antd-style";
import { isCancel } from "axios";
import {
  FoldVertical,
  LogOut,
  Menu as MenuIcon,
  Moon,
  Sun,
  UnfoldVertical,
  UserRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useNavigate } from "react-router";

import { routeTree } from "@/app/config";
import { useAntd, useCore } from "@/app/hooks";
import { getAllowedNavigation } from "@/app/lib";
import {
  type AdministratorSession,
  fetchSession,
  login,
  logout,
} from "@/features/auth";
import {
  AdminApiError,
  advanceSession,
  getSessionSignal,
  setUnauthorizedHandler,
} from "@/shared/api";
import { defaultLogoUrl } from "@/shared/config";
import { useAbortController, useLock } from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";
import { ErrorFallback } from "@/shared/ui/error-boundary";

import { Breadcrumbs } from "./components/breadcrumbs";
import { Navigation } from "./components/navigation";
import type { DefaultLayoutContext } from "./types";

type SignInAgainProps = {
  mobile: string;
  onClose: () => void;
  onSignedIn: () => Promise<void>;
};

function SignInAgain({ mobile, onClose, onSignedIn }: SignInAgainProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<{ password: string }>();
  const [error, setError] = useState<string>();
  const [cookieRefreshed, setCookieRefreshed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { start } = useAbortController();
  const { lock, unlock } = useLock();

  const submit = async (values?: { password: string }) => {
    if ((!cookieRefreshed && !values) || !lock()) return;

    const signal = start();
    setSubmitting(true);
    setError(undefined);

    try {
      if (!cookieRefreshed && values) {
        await login({ mobile, password: values.password }, signal);
        if (signal.aborted) return;

        form.resetFields();
        setCookieRefreshed(true);
      }
      await onSignedIn();
      if (!signal.aborted) onClose();
    } catch (error) {
      if (!signal.aborted && !isCancel(error)) {
        setError(getErrorMessage(error));
      }
    } finally {
      if (!signal.aborted) {
        setSubmitting(false);
        unlock();
      }
    }
  };

  return (
    <Modal
      cancelButtonProps={{ disabled: submitting || cookieRefreshed }}
      cancelText={t("cancel")}
      closable={!submitting && !cookieRefreshed}
      confirmLoading={submitting}
      keyboard={!submitting && !cookieRefreshed}
      mask={{ closable: false }}
      okText={t(cookieRefreshed ? "retry" : "login")}
      onCancel={onClose}
      onOk={() => (cookieRefreshed ? void submit() : form.submit())}
      open
      title={t("accessSignInAgain")}
      zIndex={1400}
    >
      <Typography.Paragraph>{t("accessRetryAction")}</Typography.Paragraph>
      {error && <Alert showIcon title={error} type="error" />}
      {!cookieRefreshed && (
        <Form
          disabled={submitting}
          form={form}
          layout="vertical"
          onFinish={submit}
        >
          <Form.Item label={t("mobile")}>
            <Input
              aria-label={t("mobile")}
              autoComplete="username"
              readOnly
              value={mobile}
            />
          </Form.Item>
          <Form.Item
            label={t("password")}
            name="password"
            rules={[{ required: true, max: 128 }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}

export const DefaultLayout = () => {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<AdministratorSession>();
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [open, setOpen] = useState(false);
  const [sessionDenied, setSessionDenied] = useState(false);
  const [signInAgain, setSignInAgain] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI, token } = useAntd();
  const { compact, currentRoute, settings, setCompact, setTheme, theme } =
    useCore();
  const { lock, unlock } = useLock();
  const mounted = useRef(false);
  const navigate = useNavigate();
  const { lg } = useResponsive();
  const allowedNavigation = getAllowedNavigation(currentUser);
  const darkMode = theme === "dark";
  const logo = settings[`${theme}Logo`]?.url ?? defaultLogoUrl;

  const clearSession = useCallback(() => {
    advanceSession();
    cancel();
    setCurrentUser(undefined);
    setSessionDenied(false);
    setLoading(true);
    setSignInAgain(false);
    void navigate(routeTree.auth.path, { replace: true });
  }, [cancel, navigate]);

  const handleAccessError = useCallback((error: unknown) => {
    if (
      !(error instanceof AdminApiError) ||
      error.status !== 403 ||
      error.code !== "REAUTH_REQUIRED"
    ) {
      return false;
    }

    setSignInAgain(true);
    return true;
  }, []);

  const fetchCurrentUser = useCallback(
    async (reportFailure = false) => {
      if (!mounted.current) return;

      const signal = start();
      const session = getSessionSignal();
      setLoading(true);
      let completed = false;

      try {
        const data = await fetchSession(signal);
        if (!mounted.current || signal.aborted || session.aborted) return;

        setCurrentUser(data);
        setSessionDenied(false);
        completed = true;
      } catch (error) {
        if (
          !mounted.current ||
          signal.aborted ||
          session.aborted ||
          isCancel(error)
        )
          return;

        if (error instanceof AdminApiError && error.status === 401) {
          clearSession();
          return;
        }

        setSessionDenied(
          error instanceof AdminApiError && error.status === 403,
        );
        completed = true;
        if (reportFailure)
          throw error instanceof Error
            ? error
            : new Error(getErrorMessage(error));
      } finally {
        if (completed) setLoading(false);
      }
    },
    [clearSession, start],
  );

  const handleLogout = async () => {
    if (!mounted.current || !lock()) return;

    const session = getSessionSignal();
    setLoggingOut(true);

    try {
      await logout();
      if (mounted.current && !session.aborted) clearSession();
    } catch (error) {
      if (!mounted.current || session.aborted || isCancel(error)) return;

      if (error instanceof AdminApiError && error.status === 401) {
        clearSession();
        return;
      }
      void messageAPI.error(getErrorMessage(error));
    } finally {
      if (mounted.current) {
        unlock();
        setLoggingOut(false);
      }
    }
  };

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancel();
    };
  }, [cancel]);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [clearSession]);

  useEffect(() => {
    void (async () => {
      await fetchCurrentUser();
    })();

    return cancel;
  }, [cancel, fetchCurrentUser]);

  if (!currentUser && loading)
    return (
      <Spin
        aria-label={t("loading")}
        fullscreen
        ref={(node) => node?.nativeElement.setAttribute("role", "status")}
      />
    );

  if (!currentUser)
    return (
      <>
        <ErrorFallback onRetry={fetchCurrentUser} />
        {sessionDenied && (
          <Button danger loading={loggingOut} onClick={handleLogout}>
            {t("logout")}
          </Button>
        )}
      </>
    );

  return (
    <Layout style={{ minHeight: "100dvh" }}>
      <Layout.Header style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <Flex
          align="center"
          gap={token.size}
          justify="space-between"
          style={{
            height: 64,
            marginInline: "auto",
            maxWidth: token.screenXXXL,
            paddingInline: token.paddingSM,
          }}
        >
          <Link aria-label={t("logo")} to={routeTree.root.path}>
            <img
              alt={t("logo")}
              src={logo}
              style={{ display: "block", height: 28, width: "auto" }}
            />
          </Link>
          {lg ? (
            <Navigation
              builtinPlacements={{
                bottomLeft: {
                  points:
                    settings.language.direction === "rtl"
                      ? ["tr", "br"]
                      : ["tl", "bl"],
                },
                bottomRight: {
                  points:
                    settings.language.direction === "rtl"
                      ? ["tr", "br"]
                      : ["tl", "bl"],
                },
              }}
              currentRoute={currentRoute}
              items={allowedNavigation}
              mode="horizontal"
              style={{ flexGrow: 1, lineHeight: "64px" }}
            />
          ) : (
            <Flex style={{ flexGrow: 1 }}>
              <Button
                aria-label={t("menu")}
                icon={<MenuIcon aria-hidden color="currentColor" size={16} />}
                onClick={() => setOpen(true)}
                type="text"
              />
            </Flex>
          )}
          <Dropdown
            menu={{
              items: [
                {
                  icon: darkMode ? (
                    <Sun aria-hidden color="currentColor" size={16} />
                  ) : (
                    <Moon aria-hidden color="currentColor" size={16} />
                  ),
                  key: "2",
                  label: t(darkMode ? "lightMode" : "darkMode"),
                  onClick: () => setTheme(darkMode ? "light" : "dark"),
                },
                {
                  icon: compact ? (
                    <UnfoldVertical
                      aria-hidden
                      color="currentColor"
                      size={16}
                    />
                  ) : (
                    <FoldVertical aria-hidden color="currentColor" size={16} />
                  ),
                  key: "3",
                  label: t(compact ? "normalMode" : "compactMode"),
                  onClick: () => setCompact(!compact),
                },
                {
                  danger: true,
                  disabled: loggingOut,
                  icon: <LogOut aria-hidden color="currentColor" size={16} />,
                  key: "4",
                  label: t("logout"),
                  onClick: handleLogout,
                },
              ],
            }}
          >
            <Tooltip placement="right" title={currentUser.name}>
              <Button
                aria-label={t("account")}
                icon={
                  <Avatar
                    icon={
                      <UserRound aria-hidden color="currentColor" size={16} />
                    }
                  />
                }
                loading={loggingOut}
                type="text"
              />
            </Tooltip>
          </Dropdown>
        </Flex>
      </Layout.Header>
      <Layout.Content
        style={{
          backgroundColor: token.colorBgLayout,
          marginInline: "auto",
          maxWidth: token.screenXXXL,
          minWidth: 0,
          paddingBlock: token.paddingMD,
          paddingInline: token.paddingSM,
          width: "100%",
        }}
      >
        <Breadcrumbs currentRoute={currentRoute} items={allowedNavigation} />
        <Outlet
          context={
            {
              currentUser,
              fetchCurrentUser,
              clearSession,
              handleAccessError,
            } satisfies DefaultLayoutContext<AdministratorSession>
          }
        />
      </Layout.Content>
      {signInAgain && (
        <SignInAgain
          mobile={currentUser.mobile}
          onClose={() => setSignInAgain(false)}
          onSignedIn={() => fetchCurrentUser(true)}
        />
      )}
      <Drawer
        closeIcon={false}
        onClose={() => setOpen(false)}
        open={!lg && open}
        styles={{ body: { padding: token.paddingXS } }}
        title={false}
      >
        <nav aria-label={t("menu")}>
          <Navigation
            currentRoute={currentRoute}
            items={allowedNavigation}
            mode="inline"
            onClick={() => setOpen(false)}
          />
        </nav>
      </Drawer>
    </Layout>
  );
};
