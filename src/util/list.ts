// SPDX-License-Identifier: EPL-2.0
/**
 * Generic doubly-linked list, replacing the C LIST macro.
 *
 * The C LIST macro is a type-generic ring-buffer backed dynamic array.
 * For the TypeScript port we expose the same logical API using a simple
 * doubly-linked node structure. The ring-buffer internals need not be
 * replicated; only the observable contract matters.
 *
 * @see lib/util/list.h
 */

interface ListNode<T> {
  value: T;
  prev: ListNode<T> | null;
  next: ListNode<T> | null;
}

/**
 * Type-generic doubly-linked list.
 *
 * Matches the observable behaviour of the C LIST macro:
 *   push / pop  — operate on the back (LIST_APPEND / LIST_POP_BACK)
 *   unshift / shift — operate on the front (LIST_PREPEND / LIST_POP_FRONT)
 *   remove      — linear scan by identity (LIST_REMOVE)
 *   Symbol.iterator — logical order, front to back
 */
export class List<T> {
  private _head: ListNode<T> | null = null;
  private _tail: ListNode<T> | null = null;
  private _size: number = 0;

  /** Append item to back. @see lib/util/list.h:LIST_APPEND */
  push(item: T): void {
    const node: ListNode<T> = { value: item, prev: this._tail, next: null };
    if (this._tail !== null) {
      this._tail.next = node;
    } else {
      this._head = node;
    }
    this._tail = node;
    this._size++;
  }

  /** Remove and return the last item, or undefined if empty.
   *  @see lib/util/list.h:LIST_POP_BACK */
  pop(): T | undefined {
    if (this._tail === null) return undefined;
    const value = this._tail.value;
    this._unlink(this._tail);
    return value;
  }

  /** Remove and return the first item, or undefined if empty.
   *  @see lib/util/list.h:LIST_POP_FRONT */
  shift(): T | undefined {
    if (this._head === null) return undefined;
    const value = this._head.value;
    this._unlink(this._head);
    return value;
  }

  /** Prepend item to front. @see lib/util/list.h:LIST_PREPEND */
  unshift(item: T): void {
    const node: ListNode<T> = { value: item, prev: null, next: this._head };
    if (this._head !== null) {
      this._head.prev = node;
    } else {
      this._tail = node;
    }
    this._head = node;
    this._size++;
  }

  /**
   * Remove the first occurrence of item (by reference equality).
   * Returns true if found and removed.
   * @see lib/util/list.h:LIST_REMOVE
   */
  remove(item: T): boolean {
    for (let n = this._head; n !== null; n = n.next) {
      if (n.value === item) {
        this._unlink(n);
        return true;
      }
    }
    return false;
  }

  /** Iterate items in logical order (front to back). */
  [Symbol.iterator](): Iterator<T> {
    let current = this._head;
    return {
      next(): IteratorResult<T> {
        if (current === null) return { value: undefined as unknown as T, done: true };
        const value = current.value;
        current = current.next;
        return { value, done: false };
      },
    };
  }

  /** Number of items in the list. @see lib/util/list.h:LIST_SIZE */
  get size(): number {
    return this._size;
  }

  /** Detach a node from the list. */
  private _unlink(node: ListNode<T>): void {
    if (node.prev !== null) {
      node.prev.next = node.next;
    } else {
      this._head = node.next;
    }
    if (node.next !== null) {
      node.next.prev = node.prev;
    } else {
      this._tail = node.prev;
    }
    this._size--;
  }
}
