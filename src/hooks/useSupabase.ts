import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Database } from '../lib/database.types';

type Project = Database['public']['Tables']['projects']['Row'];
type CarListing = Database['public']['Tables']['car_listings']['Row'];

interface ProjectWithListings extends Project {
  listings_count: number;
  first_listing: string | null;
  last_listing: string | null;
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithListings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) {
        setProjects([]);
        setLoading(false);
        return;
      }

      try {
        // Get projects with listing counts and date ranges
        let query = supabase
          .from('projects')
          .select(`
            *,
            car_listings (
              created_at
            )
          `)
          .order('created_at', { ascending: false });

        // If not admin, only fetch user's projects
        if (!isAdmin) {
          query = query.eq('user_id', user.id);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Process the results
        const projectsWithListings = (data || []).map(project => {
          const listings = project.car_listings || [];
          const sortedDates = listings
            .map(l => new Date(l.created_at))
            .sort((a, b) => a.getTime() - b.getTime());

          return {
            ...project,
            listings_count: listings.length,
            first_listing: sortedDates[0]?.toISOString() || null,
            last_listing: sortedDates[sortedDates.length - 1]?.toISOString() || null,
            car_listings: undefined // Remove the listings array from the result
          };
        });

        setProjects(projectsWithListings);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError(err instanceof Error ? err : new Error('An error occurred'));
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [user, isAdmin]);

  const createProject = async (project: Omit<Project, 'id' | 'created_at'>) => {
    if (!user) throw new Error('You must be logged in to create a project');

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([project])
        .select()
        .single();

      if (error) throw error;

      const projectWithListings = {
        ...data,
        listings_count: 0,
        first_listing: null,
        last_listing: null
      };

      setProjects(prev => [projectWithListings, ...prev]);
      return projectWithListings;
    } catch (err) {
      throw err instanceof Error ? err : new Error('An error occurred');
    }
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    if (!user) throw new Error('You must be logged in to update a project');

    try {
      const { data: project, error: updateError } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          car_listings (
            created_at
          )
        `)
        .single();

      if (updateError) throw updateError;

      const listings = project.car_listings || [];
      const sortedDates = listings
        .map(l => new Date(l.created_at))
        .sort((a, b) => a.getTime() - b.getTime());

      const projectWithListings = {
        ...project,
        listings_count: listings.length,
        first_listing: sortedDates[0]?.toISOString() || null,
        last_listing: sortedDates[sortedDates.length - 1]?.toISOString() || null,
        car_listings: undefined
      };

      setProjects(prev => prev.map(p => p.id === id ? projectWithListings : p));
      return projectWithListings;
    } catch (err) {
      throw err instanceof Error ? err : new Error('An error occurred');
    }
  };

  const deleteProject = async (id: string) => {
    if (!user) throw new Error('You must be logged in to delete a project');
    if (!isAdmin) throw new Error('Only administrators can delete projects');

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('An error occurred');
    }
  };

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
  };
}

export function useCarListings(projectId?: string) {
  const [listings, setListings] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    const fetchListings = async () => {
      if (!user) {
        setListings([]);
        setLoading(false);
        return;
      }

      try {
        let query = supabase
          .from('car_listings')
          .select('*')
          .order('created_at', { ascending: false });

        if (projectId) {
          query = query.eq('project_id', projectId);
        }

        // If not admin, only fetch user's listings
        if (!isAdmin) {
          query = query.eq('user_id', user.id);
        }

        const { data, error } = await query;

        if (error) throw error;
        setListings(data || []);
      } catch (err) {
        console.error('Error fetching listings:', err);
        setError(err instanceof Error ? err : new Error('An error occurred'));
        setListings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [projectId, user, isAdmin]);

  const createListing = async (listing: Omit<CarListing, 'id' | 'created_at'>) => {
    if (!user) throw new Error('You must be logged in to create a listing');

    try {
      const { data, error } = await supabase
        .from('car_listings')
        .insert([listing])
        .select()
        .single();

      if (error) throw error;
      setListings(prev => [data, ...prev]);
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('An error occurred');
    }
  };

  const updateListing = async (id: string, updates: Partial<CarListing>) => {
    if (!user) throw new Error('You must be logged in to update a listing');

    try {
      const { data, error } = await supabase
        .from('car_listings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setListings(prev => prev.map(l => l.id === id ? data : l));
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('An error occurred');
    }
  };

  const deleteListing = async (id: string) => {
    if (!user) throw new Error('You must be logged in to delete a listing');

    try {
      const { error } = await supabase
        .from('car_listings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setListings(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('An error occurred');
    }
  };

  return {
    listings,
    loading,
    error,
    createListing,
    updateListing,
    deleteListing,
  };
}