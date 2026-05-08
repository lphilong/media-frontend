export type CursorStack = {
  current?: string;
  previous: string[];
};

export const createCursorStack = (): CursorStack => ({
  current: undefined,
  previous: [],
});

export const resetCursorStack = (): CursorStack => createCursorStack();

export const canMovePreviousCursor = (stack: CursorStack): boolean => stack.previous.length > 0;

export const moveNextCursor = (stack: CursorStack, nextCursor?: string): CursorStack => {
  if (!nextCursor) {
    return stack;
  }

  return {
    current: nextCursor,
    previous: stack.current ? [...stack.previous, stack.current] : stack.previous,
  };
};

export const movePreviousCursor = (stack: CursorStack): CursorStack => {
  if (stack.previous.length === 0) {
    return createCursorStack();
  }

  const previous = [...stack.previous];
  const current = previous.pop();

  return {
    current,
    previous,
  };
};

export const syncCursorStackOnShapeChange = (
  stack: CursorStack,
  hasShapeChanged: boolean,
): CursorStack => {
  if (!hasShapeChanged) {
    return stack;
  }

  return createCursorStack();
};
