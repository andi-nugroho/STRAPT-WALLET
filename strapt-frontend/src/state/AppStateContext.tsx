import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { TokenOption } from '@/components/TokenSelect';

// Define the state structure
export interface AppState {
  // User state
  user: {
    address: string | null;
    isConnected: boolean;
    username: string | null;
  };
  
  // Token state
  tokens: {
    list: TokenOption[];
    isLoading: boolean;
    selectedToken: TokenOption | null;
  };
  
  // UI state
  ui: {
    theme: 'light' | 'dark' | 'system';
    isMobile: boolean;
    isLoading: boolean;
    currentView: string;
  };
}

// Define action types
export type AppAction =
  | { type: 'SET_USER_ADDRESS'; payload: string | null }
  | { type: 'SET_USER_CONNECTED'; payload: boolean }
  | { type: 'SET_USERNAME'; payload: string | null }
  | { type: 'SET_TOKENS'; payload: TokenOption[] }
  | { type: 'SET_TOKENS_LOADING'; payload: boolean }
  | { type: 'SET_SELECTED_TOKEN'; payload: TokenOption | null }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' | 'system' }
  | { type: 'SET_IS_MOBILE'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CURRENT_VIEW'; payload: string };

// Initial state
const initialState: AppState = {
  user: {
    address: null,
    isConnected: false,
    username: null,
  },
  tokens: {
    list: [],
    isLoading: false,
    selectedToken: null,
  },
  ui: {
    theme: 'dark',
    isMobile: false,
    isLoading: false,
    currentView: 'home',
  },
};

// Create reducer function
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_USER_ADDRESS':
      return {
        ...state,
        user: {
          ...state.user,
          address: action.payload,
        },
      };
    case 'SET_USER_CONNECTED':
      return {
        ...state,
        user: {
          ...state.user,
          isConnected: action.payload,
        },
      };
    case 'SET_USERNAME':
      return {
        ...state,
        user: {
          ...state.user,
          username: action.payload,
        },
      };
    case 'SET_TOKENS':
      return {
        ...state,
        tokens: {
          ...state.tokens,
          list: action.payload,
        },
      };
    case 'SET_TOKENS_LOADING':
      return {
        ...state,
        tokens: {
          ...state.tokens,
          isLoading: action.payload,
        },
      };
    case 'SET_SELECTED_TOKEN':
      return {
        ...state,
        tokens: {
          ...state.tokens,
          selectedToken: action.payload,
        },
      };
    case 'SET_THEME':
      return {
        ...state,
        ui: {
          ...state.ui,
          theme: action.payload,
        },
      };
    case 'SET_IS_MOBILE':
      return {
        ...state,
        ui: {
          ...state.ui,
          isMobile: action.payload,
        },
      };
    case 'SET_LOADING':
      return {
        ...state,
        ui: {
          ...state.ui,
          isLoading: action.payload,
        },
      };
    case 'SET_CURRENT_VIEW':
      return {
        ...state,
        ui: {
          ...state.ui,
          currentView: action.payload,
        },
      };
    default:
      return state;
  }
};

// Create context
interface AppStateContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

// Create provider component
export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  );
};

// Create hook for using the context
export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};

// Create custom hooks for specific state slices
export const useUserState = () => {
  const { state, dispatch } = useAppState();
  
  return {
    user: state.user,
    setAddress: (address: string | null) => 
      dispatch({ type: 'SET_USER_ADDRESS', payload: address }),
    setConnected: (isConnected: boolean) => 
      dispatch({ type: 'SET_USER_CONNECTED', payload: isConnected }),
    setUsername: (username: string | null) => 
      dispatch({ type: 'SET_USERNAME', payload: username }),
  };
};

export const useTokenState = () => {
  const { state, dispatch } = useAppState();
  
  return {
    tokens: state.tokens,
    setTokens: (tokens: TokenOption[]) => 
      dispatch({ type: 'SET_TOKENS', payload: tokens }),
    setTokensLoading: (isLoading: boolean) => 
      dispatch({ type: 'SET_TOKENS_LOADING', payload: isLoading }),
    setSelectedToken: (token: TokenOption | null) => 
      dispatch({ type: 'SET_SELECTED_TOKEN', payload: token }),
  };
};

export const useUIState = () => {
  const { state, dispatch } = useAppState();
  
  return {
    ui: state.ui,
    setTheme: (theme: 'light' | 'dark' | 'system') => 
      dispatch({ type: 'SET_THEME', payload: theme }),
    setIsMobile: (isMobile: boolean) => 
      dispatch({ type: 'SET_IS_MOBILE', payload: isMobile }),
    setLoading: (isLoading: boolean) => 
      dispatch({ type: 'SET_LOADING', payload: isLoading }),
    setCurrentView: (view: string) => 
      dispatch({ type: 'SET_CURRENT_VIEW', payload: view }),
  };
};
