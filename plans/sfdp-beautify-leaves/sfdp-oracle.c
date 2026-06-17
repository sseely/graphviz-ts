#include <graphviz/gvc.h>
#include <graphviz/cgraph.h>
#include <stdio.h>
/* ND_coord / ND_pos access */
#include <graphviz/types.h>

int main(int argc, char **argv) {
  GVC_t *gvc = gvContext();
  Agraph_t *g = agread(stdin, NULL);
  if (!g) { fprintf(stderr, "parse fail\n"); return 1; }
  gvLayout(gvc, g, "sfdp");
  for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
    double *p = ND_pos(n);
    printf("%s %.17g %.17g\n", agnameof(n), p[0], p[1]);
  }
  gvFreeLayout(gvc, g);
  agclose(g);
  gvFreeContext(gvc);
  return 0;
}
