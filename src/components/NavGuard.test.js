// Tests for the navigation guard used to offer "save as draft?" before leaving a tool.
import React from 'react';
import { renderHook } from '@testing-library/react';
import { NavGuardProvider, useNavGuard } from './NavGuard';

const wrapper = ({ children }) => <NavGuardProvider>{children}</NavGuardProvider>;

describe('NavGuard', () => {
    test('proceeds immediately when no blocker is registered', () => {
        const { result } = renderHook(() => useNavGuard(), { wrapper });
        const proceed = jest.fn();
        result.current.runGuarded(proceed);
        expect(proceed).toHaveBeenCalledTimes(1);
    });

    test('a blocker that returns true takes over (proceed is NOT auto-called)', () => {
        const { result } = renderHook(() => useNavGuard(), { wrapper });
        result.current.setBlocker(() => true); // blocker will call proceed itself later
        const proceed = jest.fn();
        result.current.runGuarded(proceed);
        expect(proceed).not.toHaveBeenCalled();
    });

    test('a blocker that returns false lets navigation proceed', () => {
        const { result } = renderHook(() => useNavGuard(), { wrapper });
        result.current.setBlocker(() => false);
        const proceed = jest.fn();
        result.current.runGuarded(proceed);
        expect(proceed).toHaveBeenCalledTimes(1);
    });

    test('the blocker receives the proceed callback', () => {
        const { result } = renderHook(() => useNavGuard(), { wrapper });
        const blocker = jest.fn(() => true);
        result.current.setBlocker(blocker);
        const proceed = jest.fn();
        result.current.runGuarded(proceed);
        expect(blocker).toHaveBeenCalledWith(proceed);
    });
});
