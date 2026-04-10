"use client";

export type AvatarState = "idling" | "speaking" | "thinking";

interface MayaAvatarProps {
  state: AvatarState;
  size?: number;
}

const avatarSrc: Record<AvatarState, string> = {
  idling: "/avatars/maya-idling.gif",
  speaking: "/avatars/maya-speaking.gif",
  thinking: "/avatars/maya-thinking.gif",
};

export function MayaAvatar({ state, size = 64 }: MayaAvatarProps) {
  return (
    <div
      className="shrink-0 rounded-full overflow-hidden bg-gray-100"
      style={{ width: size, height: size }}
    >
      <img
        src={avatarSrc[state]}
        alt={`Maya ${state}`}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
