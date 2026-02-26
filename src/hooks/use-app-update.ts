import { useEffect, useState } from "react";
import {
  checkAppUpdate,
  getAppUpdateStatus,
  installAppUpdate,
  onAppUpdateStatus,
  type AppUpdateStatus,
} from "@/lib/updater/client";

const DEFAULT_STATUS: AppUpdateStatus = {
  state: "idle",
  message: "",
  progress: 0,
};

export function useAppUpdate() {
  const [status, setStatus] = useState<AppUpdateStatus>(DEFAULT_STATUS);
  const [installing, setInstalling] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    getAppUpdateStatus()
      .then(setStatus)
      .catch(() => null);
    const unsub = onAppUpdateStatus((next) => {
      setStatus(next);
    });
    return () => unsub();
  }, []);

  async function checkNow() {
    setChecking(true);
    try {
      const next = await checkAppUpdate();
      setStatus(next);
    } finally {
      setChecking(false);
    }
  }

  async function installNow() {
    setInstalling(true);
    try {
      await installAppUpdate();
    } finally {
      setInstalling(false);
    }
  }

  return {
    status,
    checking,
    installing,
    checkNow,
    installNow,
  };
}
