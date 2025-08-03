export function sanitizeAttribute(value) {
  if (typeof value === 'string') {
    return value
      .replace(/<!--.*?-->/g, '') // Remove HTML comments
      .replace(/[<>"']/g, '')    // Remove specific characters
      .replace(/[\r\n\t]/g, ' ')   // Replace newlines/tabs with spaces
      .trim();                  // Trim whitespace
  }
  return value;
}

export function sanitizeText(value) {
  if (typeof value === 'string') {
    return value
      .replace(/<[^>]*>?/gm, '') // Remove all HTML tags
      .trim();
  }
  return value;
}


/**
 * Formats a Firebase Timestamp or JavaScript Date object into a readable string in UTC.
 * @param {object | string | null} timestamp - The Timestamp or Date object.
 * @returns {string} The formatted date and time string.
 */
export function formatTimestamp(timestamp) {
    if (!timestamp) {
        return 'N/A';
    }

    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        return 'N/A';
    }

    // Format the date and time explicitly as UTC
    const year = date.getUTCFullYear();
    const month = ('0' + (date.getUTCMonth() + 1)).slice(-2);
    const day = ('0' + date.getUTCDate()).slice(-2);
    const hours = ('0' + date.getUTCHours()).slice(-2);
    const minutes = ('0' + date.getUTCMinutes()).slice(-2);

    return `${year}/${month}/${day}, ${hours}:${minutes} (UTC)`;
}

