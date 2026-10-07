import { describe, expect, it } from 'vitest';
import { dijkstra, type GraphEdge } from '../src/modules/routing/routing.service.js';

function graph(edges: Array<[string, string, number]>): Map<string, GraphEdge[]> {
  const adjacency = new Map<string, GraphEdge[]>();
  const add = (from: string, to: string, distanceM: number) => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from)!.push({ from, to, distanceM, pathName: `${from}-${to}`, coords: [] });
  };
  for (const [a, b, d] of edges) {
    add(a, b, d);
    add(b, a, d);
  }
  return adjacency;
}

describe('dijkstra', () => {
  it('finds the shortest path, not the one with fewest edges', () => {
    const adj = graph([
      ['A', 'D', 100],
      ['A', 'B', 10],
      ['B', 'C', 10],
      ['C', 'D', 10],
    ]);
    const route = dijkstra(adj, 'A', 'D');
    expect(route?.distanceM).toBe(30);
    expect(route?.pathEdges.map((e) => e.to)).toEqual(['B', 'C', 'D']);
  });

  it('returns an empty path when start equals goal', () => {
    const route = dijkstra(graph([['A', 'B', 5]]), 'A', 'A');
    expect(route).toEqual({ distanceM: 0, pathEdges: [] });
  });

  it('returns null when the goal is unreachable', () => {
    const adj = graph([
      ['A', 'B', 5],
      ['C', 'D', 5],
    ]);
    expect(dijkstra(adj, 'A', 'D')).toBeNull();
  });

  it('returns null when the start is not in the graph', () => {
    expect(dijkstra(graph([['A', 'B', 5]]), 'X', 'B')).toBeNull();
  });

  it('works in both directions on an undirected graph', () => {
    const adj = graph([
      ['A', 'B', 5],
      ['B', 'C', 7],
    ]);
    expect(dijkstra(adj, 'C', 'A')?.distanceM).toBe(12);
  });
});
