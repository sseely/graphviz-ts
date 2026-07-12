// SPDX-License-Identifier: EPL-2.0
/**
 * C-exact cdt Dtoset for the ortho channel dictionaries.
 *
 * The ortho maze keeps its channels in two-level cdt Dtoset splay trees and
 * walks them with `dtflatten` + `dtlink` (following raw `->right` pointers).
 * Crucially, `add_p_edges` calls `chanSearch` (a `dtmatch`) WHILE walking the
 * flattened dicts: the first search UNFLATTENs the dict (the sorted right-
 * spine chain simply becomes the tree again) and every search top-down-splays
 * the tree, rewriting the very `->right` pointers the walker is following.
 * The walk therefore silently skips every channel that a splay rotation moves
 * into a left subtree — under 1447_1/osage C visits only 157 of 294 channels
 * in the parallel pass. This behavior is deterministic and LOAD-BEARING: the
 * final precedence graphs (and thus track assignments) depend on exactly
 * which channels the corrupted walk reaches.
 *
 * The repo's generic DtSplay deliberately deviates from dttree.c in the
 * not-found reassembly and insert attachment (documented in splay-core.ts),
 * which changes tree SHAPE — harmless for its users, fatal here where shape
 * drives the walk. Hence this separate byte-faithful implementation.
 *
 * Ports exactly:
 *   - dttree.c do_search loop + found (has_root) and not-found (no_root)
 *     reassembly, DT_MATCH and DT_INSERT flavours (DT_OSET only).
 *   - dtflatten.c right-linearisation (RROTATE loop) + DT_FLATTEN flag.
 *   - dthdr.h UNFLATTEN: any tree op clears the flag; for DT_OSET the
 *     flattened chain IS a valid (degenerate) tree, so no restructuring.
 *
 * @see lib/cdt/dttree.c:dttree
 * @see lib/cdt/dtflatten.c:dtflatten
 * @see lib/cdt/dtrestore.c:dtrestore
 * @see lib/ortho/ortho.c:chanSearch, assignTracks (dtflatten walks)
 */

/** Dtlink_t analogue. Walkers follow `.right` live, exactly like dtlink(). */
export interface CdtNode<T> {
  left: CdtNode<T> | null;
  right: CdtNode<T> | null;
  obj: T;
}

/** RROTATE(x,y): x.left = y.right; y.right = x. @see lib/cdt/dthdr.h */
function rrotate<T>(x: CdtNode<T>, y: CdtNode<T>): void {
  x.left = y.right;
  y.right = x;
}

/** LROTATE(x,y): x.right = y.left; y.left = x. @see lib/cdt/dthdr.h */
function lrotate<T>(x: CdtNode<T>, y: CdtNode<T>): void {
  x.right = y.left;
  y.left = x;
}

/**
 * Ordered set (DT_OSET) with C-exact splay + flatten semantics.
 * K is the search-key type; the comparator receives (searchKey, nodeKey).
 */
export class CdtOset<T, K> {
  /** dt->data.here — current root (or flattened-list head). */
  here: CdtNode<T> | null = null;
  /** DT_FLATTEN flag. */
  private flattened = false;

  constructor(
    private readonly keyOf: (obj: T) => K,
    private readonly cmp: (a: K, b: K) => number,
  ) {}

  /** UNFLATTEN(dt): clear the flag. For DT_OSET dtrestore leaves `here`
   *  pointing at the chain head — the right-spine chain IS the tree. */
  private unflatten(): void {
    this.flattened = false;
  }

  /**
   * The dttree.c do_search loop. Returns the stopped-at node (`root` in C,
   * null when the key fell off the tree) plus the partition state.
   * link.right = LEFT partition head, link.left = RIGHT partition head
   * (names inverted in C — preserved). l/r are the partition tails.
   * @see lib/cdt/dttree.c:dttree (do_search)
   */
  private search(key: K): {
    root: CdtNode<T> | null;
    link: CdtNode<T>;
    l: CdtNode<T>;
    r: CdtNode<T>;
  } {
    const link: CdtNode<T> = { left: null, right: null, obj: undefined as T };
    let l = link;
    let r = link;
    let root: CdtNode<T> | null = this.here;

    while (root !== null) {
      const cmp = this.cmp(key, this.keyOf(root.obj));
      if (cmp === 0) break;
      if (cmp < 0) {
        const t: CdtNode<T> | null = root.left;
        if (t !== null) {
          const cmp2 = this.cmp(key, this.keyOf(t.obj));
          if (cmp2 < 0) {
            rrotate(root, t);
            r.left = t; r = t; // rlink(r, t)
            root = t.left;
            if (root === null) break;
          } else if (cmp2 === 0) {
            r.left = root; r = root; // rlink(r, root)
            root = t;
            break;
          } else {
            l.right = t; l = t;      // llink(l, t)
            r.left = root; r = root; // rlink(r, root)
            root = t.right;
            if (root === null) break;
          }
        } else {
          r.left = root; r = root; // rlink(r, root)
          root = null;
          break;
        }
      } else {
        const t: CdtNode<T> | null = root.right;
        if (t !== null) {
          const cmp2 = this.cmp(key, this.keyOf(t.obj));
          if (cmp2 > 0) {
            lrotate(root, t);
            l.right = t; l = t; // llink(l, t)
            root = t.right;
            if (root === null) break;
          } else if (cmp2 === 0) {
            l.right = root; l = root; // llink(l, root)
            root = t;
            break;
          } else {
            r.left = t; r = t;       // rlink(r, t)
            l.right = root; l = root; // llink(l, root)
            root = t.left;
            if (root === null) break;
          }
        } else {
          l.right = root; l = root; // llink(l, root)
          root = null;
          break;
        }
      }
    }
    return { root, link, l, r };
  }

  /**
   * dtmatch: search by key, splaying. Returns the object or null.
   * Found: has_root reassembly. Not found: no_root reassembly.
   * @see lib/cdt/dttree.c:dttree (DT_MATCH)
   */
  match(key: K): T | null {
    this.unflatten();
    if (this.here === null) return null;
    const { root, link, l, r } = this.search(key);
    if (root !== null) {
      // found it, now isolate it (has_root)
      l.right = root.left;
      r.left = root.right;
      root.left = link.right;
      root.right = link.left;
      this.here = root;
      return root.obj;
    }
    // not found (no_root): r->left=NULL; l->right=NULL;
    // then r->left = link.right (LEFT partition under RIGHT tail),
    // here = link.left (RIGHT partition head).
    r.left = null;
    l.right = null;
    r.left = link.right;
    this.here = link.left;
    return null;
  }

  /**
   * dtinsert (DT_OSET): if an equal object exists, splay it to root and
   * return IT (the caller must discard its own copy — C frees it). Otherwise
   * the new node becomes root with the raw partitions as its subtrees.
   * @see lib/cdt/dttree.c:dttree (DT_INSERT)
   */
  insert(obj: T): T {
    this.unflatten();
    if (this.here === null) {
      this.here = { left: null, right: null, obj };
      return obj;
    }
    const key = this.keyOf(obj);
    const { root, link, l, r } = this.search(key);
    if (root !== null) {
      // duplicate: DT_OSET goto has_root — return the existing object.
      l.right = root.left;
      r.left = root.right;
      root.left = link.right;
      root.right = link.left;
      this.here = root;
      return root.obj;
    }
    // not found: close partitions, then dt_insert -> has_root with new node.
    r.left = null;
    l.right = null;
    const node: CdtNode<T> = { left: link.right, right: link.left, obj };
    this.here = node;
    return obj;
  }

  /**
   * dtflatten: right-linearise the tree into a sorted chain (returns head).
   * Early-returns the existing chain when already flattened.
   * @see lib/cdt/dtflatten.c:dtflatten
   */
  flatten(): CdtNode<T> | null {
    if (this.flattened) return this.here;
    let r = this.here;
    let list: CdtNode<T> | null = null;
    if (r !== null) {
      let t: CdtNode<T> | null;
      while ((t = r.left) !== null) rrotate(r, t), (r = t);
      let last = r;
      list = r;
      for (r = r.right; r !== null; last = r, r = r.right) {
        if ((t = r.left) !== null) {
          do {
            rrotate(r, t);
            r = t;
          } while ((t = r.left) !== null);
          last.right = r;
        }
      }
    }
    this.here = list;
    this.flattened = true;
    return list;
  }
}
