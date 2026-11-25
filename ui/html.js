// @ts-check
// The only importer of vendor/preact and vendor/htm.
import { h, render, Fragment, createPortal, createContext } from '../vendor/preact/preact.mjs';
import {
  useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useErrorBoundary, useContext,
} from '../vendor/preact/hooks.mjs';
import htm from '../vendor/htm/htm.mjs';

/** Tagged template → virtual nodes. Values are always text or attributes, never markup. */
export const html = htm.bind(h);

export {
  h, render, Fragment, createPortal, createContext,
  useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useErrorBoundary, useContext,
};
