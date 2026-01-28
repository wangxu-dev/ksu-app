import { useMemo } from "react";
import { LoginForm } from "@/components/login/login-form";

const CAMPUS_IMAGES = [
  "/CampusAndSnowPeak.png",
  "/CampusClockTower.png",
  "/CampusComplex.png",
  "/CampusLakePark.png",
  "/CampusPanorama.png",
] as const;

export function LoginPage() {
  const randomImage = useMemo(
    () => CAMPUS_IMAGES[Math.floor(Math.random() * CAMPUS_IMAGES.length)],
    []
  );

  return (
    <div className="min-h-screen flex flex-row">
      {/* 左侧：校园风光 50% */}
      <div className="w-1/2 h-screen relative overflow-hidden">
        <img
          src={randomImage}
          alt="喀什大学校园风光"
          className="w-full h-full object-cover"
        />
      </div>

      {/* 右侧：登录表单 50% */}
      <div className="w-1/2 flex items-center justify-center bg-background p-6 min-h-screen">
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
