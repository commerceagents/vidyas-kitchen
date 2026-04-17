"use client";

interface LocationLite {
  label: string;
  inRange: boolean;
}

interface MobileHomeScreenProps {
  displayName: string;
  location: LocationLite | null;
}

export function MobileHomeScreen({ displayName, location }: MobileHomeScreenProps) {
  void displayName;
  void location;

  return (
    <div className="vk-mobile-ui relative h-full w-full bg-[#0d0b0b] text-white" />
  );
}
