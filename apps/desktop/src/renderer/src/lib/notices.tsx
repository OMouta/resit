import { XIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@resit/ui/components/button";
import { InlineMessage } from "@resit/ui/components/inline-message";
import { useLocale } from "@resit/ui/hooks/use-locale";

import { errorMessage } from "./api";

interface Notice {
  id: number;
  tone: "error" | "info" | "success";
  title: string;
  detail?: string;
}

interface Notices {
  notify: (notice: Omit<Notice, "id">) => void;
  /** Shows a failed action with the error's own message. */
  fail: (title: string, error: unknown) => void;
}

const NoticeContext = createContext<Notices | null>(null);

export function NoticeProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const [notices, setNotices] = useState<Notice[]>([]);

  const dismiss = useCallback((id: number) => {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  const notify = useCallback(
    (notice: Omit<Notice, "id">) => {
      const id = Date.now() + Math.random();
      setNotices((current) => [...current.slice(-2), { ...notice, id }]);
      window.setTimeout(
        () => dismiss(id),
        notice.tone === "error" ? 10_000 : 4_000,
      );
    },
    [dismiss],
  );

  const value = useMemo<Notices>(
    () => ({
      notify,
      fail: (title, error) =>
        notify({ tone: "error", title, detail: errorMessage(error) }),
    }),
    [notify],
  );

  return (
    <NoticeContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-toast flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {notices.map((notice) => (
          <InlineMessage
            key={notice.id}
            tone={notice.tone}
            title={notice.title}
            className="pointer-events-auto shadow-md"
            actions={
              <Button
                size="sm"
                variant="subtle"
                onClick={() => dismiss(notice.id)}
              >
                <XIcon /> {t("Dismiss")}
              </Button>
            }
          >
            {notice.detail ? <p>{notice.detail}</p> : null}
          </InlineMessage>
        ))}
      </div>
    </NoticeContext.Provider>
  );
}

export function useNotices(): Notices {
  const value = useContext(NoticeContext);
  if (!value) throw new Error("useNotices outside NoticeProvider");
  return value;
}
