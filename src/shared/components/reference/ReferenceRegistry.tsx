import { createContext, useContext, type ReactNode } from 'react';

export type ReferenceRegistry = Record<string, unknown>;

const ReferenceRegistryContext = createContext<ReferenceRegistry | null>(null);

export const ReferenceRegistryProvider = ({
  children,
  registry,
}: {
  children: ReactNode;
  registry: ReferenceRegistry;
}): JSX.Element => {
  return (
    <ReferenceRegistryContext.Provider value={registry}>
      {children}
    </ReferenceRegistryContext.Provider>
  );
};

export const useReferenceRegistry = <TRegistry extends ReferenceRegistry>(): TRegistry => {
  const registry = useContext(ReferenceRegistryContext);

  if (!registry) {
    throw new Error('ReferenceRegistryProvider is required to resolve reference loaders.');
  }

  return registry as TRegistry;
};
