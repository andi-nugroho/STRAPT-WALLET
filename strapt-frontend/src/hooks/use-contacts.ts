import { useState, useEffect, useCallback } from 'react';
import { useXellarWallet } from './use-xellar-wallet';

// Define the contact type
export interface Contact {
  id: string;
  name: string;
  address: string;
  username: string;
  avatar: string;
  isFavorite?: boolean;
  lastInteraction?: string; // ISO date string
}

// Mock contacts for fallback
const mockContacts: Contact[] = [
  { id: '1', name: 'Sarah Miller', address: '0x1234...5678', username: '@sarah', avatar: '' },
  { id: '2', name: 'Alex Rodriguez', address: '0x9876...5432', username: '@alex_r', avatar: '' },
  { id: '3', name: 'Jamie Smith', address: '0x6543...2109', username: '@jamies', avatar: '' },
  { id: '4', name: 'Taylor Wong', address: '0x8765...4321', username: '@taylor', avatar: '' },
];

// Local storage key
const CONTACTS_STORAGE_KEY = 'strapt_contacts';

/**
 * Hook to manage contacts
 */
export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { address } = useXellarWallet();

  // Load contacts from local storage
  useEffect(() => {
    const loadContacts = () => {
      if (!address) {
        setContacts(mockContacts);
        setIsLoading(false);
        return;
      }

      try {
        // Use a user-specific key to store contacts
        const storageKey = `${CONTACTS_STORAGE_KEY}_${address}`;
        const storedContacts = localStorage.getItem(storageKey);
        
        if (storedContacts) {
          const parsedContacts = JSON.parse(storedContacts);
          setContacts(parsedContacts);
        } else {
          // If no stored contacts, use mock data
          setContacts(mockContacts);
        }
      } catch (error) {
        console.error('Error loading contacts:', error);
        setContacts(mockContacts);
      }
      
      setIsLoading(false);
    };

    loadContacts();
  }, [address]);

  // Save contacts to local storage
  const saveContacts = useCallback((updatedContacts: Contact[]) => {
    if (!address) return;

    try {
      const storageKey = `${CONTACTS_STORAGE_KEY}_${address}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedContacts));
    } catch (error) {
      console.error('Error saving contacts:', error);
    }
  }, [address]);

  // Add a new contact
  const addContact = useCallback((contact: Omit<Contact, 'id'>) => {
    if (!address) return;

    const newContact: Contact = {
      ...contact,
      id: `contact_${Date.now()}`,
    };

    setContacts(prevContacts => {
      const updatedContacts = [...prevContacts, newContact];
      saveContacts(updatedContacts);
      return updatedContacts;
    });
  }, [address, saveContacts]);

  // Update an existing contact
  const updateContact = useCallback((id: string, updates: Partial<Contact>) => {
    if (!address) return;

    setContacts(prevContacts => {
      const updatedContacts = prevContacts.map(contact => 
        contact.id === id ? { ...contact, ...updates } : contact
      );
      saveContacts(updatedContacts);
      return updatedContacts;
    });
  }, [address, saveContacts]);

  // Remove a contact
  const removeContact = useCallback((id: string) => {
    if (!address) return;

    setContacts(prevContacts => {
      const updatedContacts = prevContacts.filter(contact => contact.id !== id);
      saveContacts(updatedContacts);
      return updatedContacts;
    });
  }, [address, saveContacts]);

  // Toggle favorite status
  const toggleFavorite = useCallback((id: string) => {
    if (!address) return;

    setContacts(prevContacts => {
      const updatedContacts = prevContacts.map(contact => 
        contact.id === id ? { ...contact, isFavorite: !contact.isFavorite } : contact
      );
      saveContacts(updatedContacts);
      return updatedContacts;
    });
  }, [address, saveContacts]);

  // Search contacts
  const searchContacts = useCallback((query: string) => {
    if (!query) return contacts;
    
    const lowerQuery = query.toLowerCase();
    return contacts.filter(contact => 
      contact.name.toLowerCase().includes(lowerQuery) ||
      contact.username.toLowerCase().includes(lowerQuery) ||
      contact.address.toLowerCase().includes(lowerQuery)
    );
  }, [contacts]);

  return {
    contacts,
    isLoading,
    addContact,
    updateContact,
    removeContact,
    toggleFavorite,
    searchContacts
  };
}
