#!/bin/bash

# Script to update fee references in frontend files

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Updating fee references in frontend files...${NC}"

# Function to update a file using the .update file
update_file() {
  local file=$1
  local update_file="${file}.update"
  
  if [ ! -f "$file" ]; then
    echo -e "${RED}Error: Original file $file not found.${NC}"
    return 1
  fi
  
  if [ ! -f "$update_file" ]; then
    echo -e "${RED}Error: Update file $update_file not found.${NC}"
    return 1
  fi
  
  # Read the update file
  while IFS= read -r line; do
    # Skip comment lines
    if [[ $line == "// "* ]]; then
      continue
    fi
    
    # If we find a "// Replace:" line, start the replacement process
    if [[ $line == "// Replace:" ]]; then
      # Read the old content until we find "// With:"
      old_content=""
      while IFS= read -r replace_line; do
        if [[ $replace_line == "// With:" ]]; then
          break
        fi
        old_content+="$replace_line"$'\n'
      done
      
      # Read the new content until the end of file or another comment
      new_content=""
      while IFS= read -r with_line; do
        if [[ $with_line == "// "* ]]; then
          break
        fi
        new_content+="$with_line"$'\n'
      done
      
      # Remove trailing newline
      old_content=${old_content%$'\n'}
      new_content=${new_content%$'\n'}
      
      # Escape special characters for sed
      old_content_escaped=$(echo "$old_content" | sed 's/[\/&]/\\&/g')
      new_content_escaped=$(echo "$new_content" | sed 's/[\/&]/\\&/g')
      
      # Perform the replacement
      if [ "$(uname)" == "Darwin" ]; then
        # macOS
        sed -i '' "s/$old_content_escaped/$new_content_escaped/g" "$file"
      else
        # Linux
        sed -i "s/$old_content_escaped/$new_content_escaped/g" "$file"
      fi
      
      echo -e "${GREEN}Updated: $file${NC}"
    fi
  done < "$update_file"
}

# Update ConfirmTransferForm.tsx
echo "Updating ConfirmTransferForm.tsx..."
update_file "strapt-frontend/src/components/transfer/ConfirmTransferForm.tsx"

# Update TransferSuccessView.tsx
echo "Updating TransferSuccessView.tsx..."
update_file "strapt-frontend/src/components/transfer/TransferSuccessView.tsx"

# Update DirectTransfer.tsx
echo "Updating DirectTransfer.tsx..."
update_file "strapt-frontend/src/components/DirectTransfer.tsx"

# Update use-payment-stream.ts
echo "Updating use-payment-stream.ts..."
update_file "strapt-frontend/src/hooks/use-payment-stream.ts"

# Update TokenSelect.tsx
echo "Updating TokenSelect.tsx..."
update_file "strapt-frontend/src/components/TokenSelect.tsx"

echo -e "${GREEN}All frontend fee references have been updated!${NC}"
