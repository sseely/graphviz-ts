// SPDX-License-Identifier: EPL-2.0
//
// Unit tests for test/corpus/corpus-links.ts (T2,
// plans/docs-overhaul/batch-1/T2-gitlab-test-links.md).

import { describe, it, expect } from 'vitest';
import { CORPUS_GITLAB_BLOB, gitlabTestUrl, testIdLink, scrubLocalPaths } from './corpus-links.js';

describe('gitlabTestUrl', () => {
  it('joins a bare corpus-relative path to the gitlab blob URL', () => {
    expect(gitlabTestUrl('1447.dot')).toBe(
      'https://gitlab.com/graphviz/graphviz/-/blob/main/tests/1447.dot',
    );
  });

  it('preserves a subdirectory in the corpus-relative path', () => {
    expect(gitlabTestUrl('imagepath_test/base.gv')).toBe(
      `${CORPUS_GITLAB_BLOB}/imagepath_test/base.gv`,
    );
  });

  it('preserves a nested subdirectory (graphs/b53.gv)', () => {
    expect(gitlabTestUrl('graphs/b53.gv')).toBe(`${CORPUS_GITLAB_BLOB}/graphs/b53.gv`);
  });

  it('strips a leading tests/ segment so it does not double up', () => {
    expect(gitlabTestUrl('tests/1447.dot')).toBe(`${CORPUS_GITLAB_BLOB}/1447.dot`);
  });

  it('normalizes backslash separators', () => {
    expect(gitlabTestUrl('imagepath_test\\base.gv')).toBe(
      `${CORPUS_GITLAB_BLOB}/imagepath_test/base.gv`,
    );
  });
});

describe('testIdLink', () => {
  it('yields a markdown link to the gitlab blob when a path is known', () => {
    expect(testIdLink('1447', '1447.dot')).toBe(
      '[`1447`](https://gitlab.com/graphviz/graphviz/-/blob/main/tests/1447.dot)',
    );
  });

  it('yields inline code (no link) when no path is known', () => {
    expect(testIdLink('1447')).toBe('`1447`');
  });
});

describe('scrubLocalPaths', () => {
  const roots = ['/Users/scottseely/git/graphviz'];

  it('collapses the oracle binary invocation path to `dot` and links the tests/ path', () => {
    const msg =
      'Command failed: /Users/scottseely/git/graphviz/build/cmd/dot/dot -K circo ' +
      '-Txdot /Users/scottseely/git/graphviz/tests/1447.dot';
    const out = scrubLocalPaths(msg, roots);
    expect(out).not.toContain('/Users/scottseely');
    expect(out).toContain('dot -K circo -Txdot');
    expect(out).toContain(
      'https://gitlab.com/graphviz/graphviz/-/blob/main/tests/1447.dot',
    );
  });

  it('collapses a spawnSync ETIMEDOUT message referencing the oracle binary', () => {
    const msg = 'spawnSync /Users/scottseely/git/graphviz/build/cmd/dot/dot ETIMEDOUT';
    expect(scrubLocalPaths(msg, roots)).toBe('spawnSync dot ETIMEDOUT');
  });

  it('preserves a subdirectory corpus-relative path (graphs/b53.gv)', () => {
    const msg =
      'Command failed: /Users/scottseely/git/graphviz/build/cmd/dot/dot -K fdp ' +
      '-Txdot /Users/scottseely/git/graphviz/tests/graphs/b53.gv';
    const out = scrubLocalPaths(msg, roots);
    expect(out).not.toContain('/Users/scottseely');
    expect(out).toContain(`${CORPUS_GITLAB_BLOB}/graphs/b53.gv`);
  });

  it('strips a bare root occurrence that matches neither special-case pattern', () => {
    const msg = 'ENOENT: no such file or directory, open \'/Users/scottseely/somefile.txt\'';
    const out = scrubLocalPaths(msg, ['/Users/scottseely']);
    expect(out).not.toContain('/Users/scottseely');
    expect(out).toContain('somefile.txt');
  });

  it('is a no-op when the message has no local paths', () => {
    const msg = 'graph is empty';
    expect(scrubLocalPaths(msg, roots)).toBe('graph is empty');
  });

  it('is pure given explicit roots — independent of process.env/os.homedir()', () => {
    const msg =
      'Command failed: /Users/scottseely/git/graphviz/build/cmd/dot/dot -K circo ' +
      '-Txdot /Users/scottseely/git/graphviz/tests/1447.dot';
    const originalCorpusRoot = process.env.CORPUS_ROOT;
    const originalGvbindir = process.env.GVBINDIR;
    process.env.CORPUS_ROOT = '/some/other/env/root';
    process.env.GVBINDIR = '/some/other/env/gvbindir';
    try {
      expect(scrubLocalPaths(msg, roots)).toBe(scrubLocalPaths(msg, roots));
      const out = scrubLocalPaths(msg, roots);
      expect(out).not.toContain('/Users/scottseely');
      expect(out).toContain('https://gitlab.com/graphviz/graphviz/-/blob/main/tests/1447.dot');
    } finally {
      if (originalCorpusRoot === undefined) delete process.env.CORPUS_ROOT;
      else process.env.CORPUS_ROOT = originalCorpusRoot;
      if (originalGvbindir === undefined) delete process.env.GVBINDIR;
      else process.env.GVBINDIR = originalGvbindir;
    }
  });

  it('with an explicit empty roots array, still applies the structural rewrites', () => {
    const msg = 'spawnSync /some/build/cmd/dot/dot ETIMEDOUT';
    expect(scrubLocalPaths(msg, [])).toBe('spawnSync dot ETIMEDOUT');
  });
});
