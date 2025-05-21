
import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Search, ArrowUpRight, Star, StarOff, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useContacts } from '@/hooks/use-contacts';
import { useToast } from '@/hooks/use-toast';

const QuickContacts = () => {
  const { contacts, isLoading, addContact, toggleFavorite, searchContacts } = useContacts();
  const [showAddContact, setShowAddContact] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Form refs
  const nameRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);

  // Use the search function from the hook
  const filteredContacts = searchQuery ? searchContacts(searchQuery) : contacts;

  const handleTransfer = (contactId: string) => {
    // Pre-fill the transfer form with the contact's info
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      navigate('/app/transfer', {
        state: { recipient: contact.address, username: contact.username }
      });
    }
  };

  const handleToggleFavorite = (contactId: string) => {
    toggleFavorite(contactId);
    toast({
      title: "Contact updated",
      description: "Contact favorite status has been updated",
      duration: 3000,
    });
  };

  const handleAddContact = (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    // Get values from refs
    const name = nameRef.current?.value || '';
    const username = usernameRef.current?.value || '';
    const address = addressRef.current?.value || '';

    // Validate
    if (!name || !username || !address) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive",
        duration: 3000,
      });
      setIsSubmitting(false);
      return;
    }

    // Add the contact
    addContact({
      name,
      username,
      address,
      avatar: '',
      isFavorite: false,
      lastInteraction: new Date().toISOString()
    });

    // Reset form and close dialog
    if (nameRef.current) nameRef.current.value = '';
    if (usernameRef.current) usernameRef.current.value = '';
    if (addressRef.current) addressRef.current.value = '';

    toast({
      title: "Contact added",
      description: `${name} has been added to your contacts`,
      duration: 3000,
    });

    setIsSubmitting(false);
    setShowAddContact(false);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Quick Contacts</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowAddContact(true)}>
              <UserPlus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          <CardDescription>Quickly send funds to your frequent contacts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {isLoading ? (
              // Loading state
              Array.from({ length: 3 }).map((_, index) => (
                <div key={`skeleton-contact-${index}-${Date.now()}`} className="flex items-center justify-between bg-secondary/30 rounded-lg p-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted" />
                    <div>
                      <div className="h-4 w-24 bg-muted rounded mb-2" />
                      <div className="h-3 w-16 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 w-8 rounded-md bg-muted" />
                    <div className="h-8 w-8 rounded-md bg-muted" />
                  </div>
                </div>
              ))
            ) : filteredContacts.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No contacts found</p>
            ) : (
              filteredContacts.map(contact => (
                <div key={contact.id} className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={contact.avatar} />
                      <AvatarFallback>{contact.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">{contact.username}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      title={contact.isFavorite ? "Remove from favorites" : "Mark as favorite"}
                      onClick={() => handleToggleFavorite(contact.id)}
                    >
                      {contact.isFavorite ? (
                        <Star className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <StarOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleTransfer(contact.id)}
                      title="Send funds"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
            <DialogDescription>
              Add someone to your quick contacts for faster transfers
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddContact}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Contact name" ref={nameRef} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="username">Username or ENS</Label>
                <Input id="username" placeholder="@username or name.eth" ref={usernameRef} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Wallet Address</Label>
                <Input id="address" placeholder="0x..." ref={addressRef} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddContact(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Contact'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuickContacts;
