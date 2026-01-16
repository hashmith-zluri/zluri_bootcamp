import { renderHook, act, waitFor } from '@testing-library/react';
import { useApi, useFetch } from '../../src/hooks/useApi';

describe('useApi', () => {
  describe('initial state', () => {
    it('should have null data, false loading, and null error initially', () => {
      const mockApiFunction = jest.fn();
      const { result } = renderHook(() => useApi(mockApiFunction));
      
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('execute', () => {
    it('should set loading to true during execution', async () => {
      const mockApiFunction = jest.fn().mockResolvedValue({ success: true });
      const { result } = renderHook(() => useApi(mockApiFunction));
      
      act(() => {
        result.current.execute();
      });
      
      expect(result.current.loading).toBe(true);
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should set data on successful execution', async () => {
      const mockData = { success: true, data: 'test' };
      const mockApiFunction = jest.fn().mockResolvedValue(mockData);
      const { result } = renderHook(() => useApi(mockApiFunction));
      
      await act(async () => {
        await result.current.execute();
      });
      
      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should pass arguments to api function', async () => {
      const mockApiFunction = jest.fn().mockResolvedValue({ success: true });
      const { result } = renderHook(() => useApi(mockApiFunction));
      
      await act(async () => {
        await result.current.execute('arg1', 'arg2', 'arg3');
      });
      
      expect(mockApiFunction).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });

    it('should set error on failed execution', async () => {
      const mockError = new Error('API Error');
      const mockApiFunction = jest.fn().mockRejectedValue(mockError);
      const { result } = renderHook(() => useApi(mockApiFunction));
      
      await act(async () => {
        try {
          await result.current.execute();
        } catch (err) {
          // Expected to throw
        }
      });
      
      expect(result.current.error).toBe('API Error');
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should throw error on failed execution', async () => {
      const mockError = new Error('API Error');
      const mockApiFunction = jest.fn().mockRejectedValue(mockError);
      const { result } = renderHook(() => useApi(mockApiFunction));
      
      await expect(async () => {
        await act(async () => {
          await result.current.execute();
        });
      }).rejects.toThrow('API Error');
    });

    it('should clear previous error on new execution', async () => {
      const mockApiFunction = jest.fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce({ success: true });
      
      const { result } = renderHook(() => useApi(mockApiFunction));
      
      // First execution fails
      await act(async () => {
        try {
          await result.current.execute();
        } catch (err) {
          // Expected
        }
      });
      
      expect(result.current.error).toBe('First error');
      
      // Second execution succeeds
      await act(async () => {
        await result.current.execute();
      });
      
      expect(result.current.error).toBeNull();
      expect(result.current.data).toEqual({ success: true });
    });

    it('should return result from execute', async () => {
      const mockData = { success: true };
      const mockApiFunction = jest.fn().mockResolvedValue(mockData);
      const { result } = renderHook(() => useApi(mockApiFunction));
      
      let returnedData;
      await act(async () => {
        returnedData = await result.current.execute();
      });
      
      expect(returnedData).toEqual(mockData);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', async () => {
      const mockData = { success: true };
      const mockApiFunction = jest.fn().mockResolvedValue(mockData);
      const { result } = renderHook(() => useApi(mockApiFunction));
      
      // Execute to set some state
      await act(async () => {
        await result.current.execute();
      });
      
      expect(result.current.data).toEqual(mockData);
      
      // Reset
      act(() => {
        result.current.reset();
      });
      
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should reset error state', async () => {
      const mockApiFunction = jest.fn().mockRejectedValue(new Error('Test error'));
      const { result } = renderHook(() => useApi(mockApiFunction));
      
      // Execute to set error
      await act(async () => {
        try {
          await result.current.execute();
        } catch (err) {
          // Expected
        }
      });
      
      expect(result.current.error).toBe('Test error');
      
      // Reset
      act(() => {
        result.current.reset();
      });
      
      expect(result.current.error).toBeNull();
    });
  });

  describe('multiple executions', () => {
    it('should handle multiple sequential executions', async () => {
      const mockApiFunction = jest.fn()
        .mockResolvedValueOnce({ data: 1 })
        .mockResolvedValueOnce({ data: 2 })
        .mockResolvedValueOnce({ data: 3 });
      
      const { result } = renderHook(() => useApi(mockApiFunction));
      
      await act(async () => {
        await result.current.execute();
      });
      expect(result.current.data).toEqual({ data: 1 });
      
      await act(async () => {
        await result.current.execute();
      });
      expect(result.current.data).toEqual({ data: 2 });
      
      await act(async () => {
        await result.current.execute();
      });
      expect(result.current.data).toEqual({ data: 3 });
    });
  });
});

describe('useFetch', () => {
  describe('initial state', () => {
    it('should have null data, true loading, and null error initially', () => {
      const mockApiFunction = jest.fn().mockResolvedValue({ success: true });
      const { result } = renderHook(() => useFetch(mockApiFunction));
      
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  describe('refetch', () => {
    it('should fetch data on refetch', async () => {
      const mockData = { success: true, data: 'test' };
      const mockApiFunction = jest.fn().mockResolvedValue(mockData);
      const { result } = renderHook(() => useFetch(mockApiFunction));
      
      await act(async () => {
        await result.current.refetch();
      });
      
      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should set loading to true during refetch', async () => {
      const mockApiFunction = jest.fn().mockResolvedValue({ success: true });
      const { result } = renderHook(() => useFetch(mockApiFunction));
      
      act(() => {
        result.current.refetch();
      });
      
      expect(result.current.loading).toBe(true);
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should set error on failed refetch', async () => {
      const mockError = new Error('Fetch Error');
      const mockApiFunction = jest.fn().mockRejectedValue(mockError);
      const { result } = renderHook(() => useFetch(mockApiFunction));
      
      await act(async () => {
        await result.current.refetch();
      });
      
      expect(result.current.error).toBe('Fetch Error');
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should clear previous error on successful refetch', async () => {
      const mockApiFunction = jest.fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce({ success: true });
      
      const { result } = renderHook(() => useFetch(mockApiFunction));
      
      // First refetch fails
      await act(async () => {
        await result.current.refetch();
      });
      
      expect(result.current.error).toBe('First error');
      
      // Second refetch succeeds
      await act(async () => {
        await result.current.refetch();
      });
      
      expect(result.current.error).toBeNull();
      expect(result.current.data).toEqual({ success: true });
    });

    it('should return result from refetch', async () => {
      const mockData = { success: true };
      const mockApiFunction = jest.fn().mockResolvedValue(mockData);
      const { result } = renderHook(() => useFetch(mockApiFunction));
      
      let returnedData;
      await act(async () => {
        returnedData = await result.current.refetch();
      });
      
      expect(returnedData).toEqual(mockData);
    });
  });

  describe('setData', () => {
    it('should allow manual data updates', async () => {
      const mockApiFunction = jest.fn().mockResolvedValue({ initial: true });
      const { result } = renderHook(() => useFetch(mockApiFunction));
      
      await act(async () => {
        await result.current.refetch();
      });
      
      expect(result.current.data).toEqual({ initial: true });
      
      act(() => {
        result.current.setData({ updated: true });
      });
      
      expect(result.current.data).toEqual({ updated: true });
    });
  });
});
