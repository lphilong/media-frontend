import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';

export type ModulePageActionsRegistrar = (actions: ReactNode | null) => void;

const noopPageActionsRegistrar: ModulePageActionsRegistrar = () => undefined;

const ModulePageActionsContext =
  createContext<ModulePageActionsRegistrar>(noopPageActionsRegistrar);

export const ModulePageActionsProvider = ({
  children,
  registerPageActions,
}: {
  children: ReactNode;
  registerPageActions: ModulePageActionsRegistrar;
}): JSX.Element => {
  return (
    <ModulePageActionsContext.Provider value={registerPageActions}>
      {children}
    </ModulePageActionsContext.Provider>
  );
};

export const useModulePageActions = (actions: ReactNode | null): void => {
  const registerPageActions = useContext(ModulePageActionsContext);

  useEffect(() => {
    registerPageActions(actions);

    return () => {
      registerPageActions(null);
    };
  }, [actions, registerPageActions]);
};

export type ModuleAccessChecker = (moduleId: string) => boolean;

const ModuleAccessContext = createContext<ModuleAccessChecker>(() => false);

export const ModuleAccessProvider = ({
  canAccessModule,
  children,
}: {
  canAccessModule: ModuleAccessChecker;
  children: ReactNode;
}): JSX.Element => {
  return (
    <ModuleAccessContext.Provider value={canAccessModule}>{children}</ModuleAccessContext.Provider>
  );
};

export const useModuleAccessChecker = (): ModuleAccessChecker => {
  return useContext(ModuleAccessContext);
};

export const useStableModulePageActionsRegistrar = (
  registerPageActions: ModulePageActionsRegistrar,
): ModulePageActionsRegistrar => {
  return useCallback((actions) => registerPageActions(actions), [registerPageActions]);
};
