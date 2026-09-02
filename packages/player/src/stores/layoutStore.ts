import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LayoutState {
  leftSidebar: {
    isCollapsed: boolean;
    width: number;
  };
  rightSidebar: {
    isCollapsed: boolean;
    width: number;
  };
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftSidebarWidth: (width: number) => void;
  setRightSidebarWidth: (width: number) => void;
}

const isMobileDevice =
  typeof window !== 'undefined' &&
  (window.innerWidth < 768 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    ));

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      leftSidebar: {
        isCollapsed: isMobileDevice,
        width: 200,
      },
      rightSidebar: {
        isCollapsed: true,
        width: 200,
      },
      toggleLeftSidebar: () =>
        set((state) => ({
          leftSidebar: {
            ...state.leftSidebar,
            isCollapsed: !state.leftSidebar.isCollapsed,
          },
        })),
      toggleRightSidebar: () =>
        set((state) => ({
          rightSidebar: {
            ...state.rightSidebar,
            isCollapsed: !state.rightSidebar.isCollapsed,
          },
        })),
      setLeftSidebarWidth: (width: number) =>
        set((state) => ({
          leftSidebar: {
            ...state.leftSidebar,
            width,
          },
        })),
      setRightSidebarWidth: (width: number) =>
        set((state) => ({
          rightSidebar: {
            ...state.rightSidebar,
            width,
          },
        })),
    }),
    {
      name: 'nuclear-layout-store',
    },
  ),
);
