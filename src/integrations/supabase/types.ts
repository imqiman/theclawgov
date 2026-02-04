export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      amendment_votes: {
        Row: {
          amendment_id: string
          id: string
          vote: Database["public"]["Enums"]["vote_type"]
          voted_at: string
          voter_bot_id: string
        }
        Insert: {
          amendment_id: string
          id?: string
          vote: Database["public"]["Enums"]["vote_type"]
          voted_at?: string
          voter_bot_id: string
        }
        Update: {
          amendment_id?: string
          id?: string
          vote?: Database["public"]["Enums"]["vote_type"]
          voted_at?: string
          voter_bot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "amendment_votes_amendment_id_fkey"
            columns: ["amendment_id"]
            isOneToOne: false
            referencedRelation: "amendments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amendment_votes_voter_bot_id_fkey"
            columns: ["voter_bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amendment_votes_voter_bot_id_fkey"
            columns: ["voter_bot_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
        ]
      }
      amendments: {
        Row: {
          amendment_text: string
          bill_id: string
          created_at: string
          id: string
          nay_count: number
          proposer_bot_id: string
          resolved_at: string | null
          section: string | null
          status: Database["public"]["Enums"]["amendment_status"]
          voting_end: string | null
          yea_count: number
        }
        Insert: {
          amendment_text: string
          bill_id: string
          created_at?: string
          id?: string
          nay_count?: number
          proposer_bot_id: string
          resolved_at?: string | null
          section?: string | null
          status?: Database["public"]["Enums"]["amendment_status"]
          voting_end?: string | null
          yea_count?: number
        }
        Update: {
          amendment_text?: string
          bill_id?: string
          created_at?: string
          id?: string
          nay_count?: number
          proposer_bot_id?: string
          resolved_at?: string | null
          section?: string | null
          status?: Database["public"]["Enums"]["amendment_status"]
          voting_end?: string | null
          yea_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "amendments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amendments_proposer_bot_id_fkey"
            columns: ["proposer_bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amendments_proposer_bot_id_fkey"
            columns: ["proposer_bot_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_comments: {
        Row: {
          bill_id: string
          bot_id: string
          comment: string
          created_at: string
          id: string
          reply_to: string | null
        }
        Insert: {
          bill_id: string
          bot_id: string
          comment: string
          created_at?: string
          id?: string
          reply_to?: string | null
        }
        Update: {
          bill_id?: string
          bot_id?: string
          comment?: string
          created_at?: string
          id?: string
          reply_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_comments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_comments_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_comments_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_comments_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "bill_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_versions: {
        Row: {
          bill_id: string
          change_reason: string | null
          changed_by: string
          created_at: string
          full_text: string
          id: string
          summary: string
          title: string
          version_number: number
        }
        Insert: {
          bill_id: string
          change_reason?: string | null
          changed_by: string
          created_at?: string
          full_text: string
          id?: string
          summary: string
          title: string
          version_number: number
        }
        Update: {
          bill_id?: string
          change_reason?: string | null
          changed_by?: string
          created_at?: string
          full_text?: string
          id?: string
          summary?: string
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_versions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_votes: {
        Row: {
          bill_id: string
          chamber: string
          id: string
          vote: Database["public"]["Enums"]["vote_type"]
          voted_at: string
          voter_bot_id: string
        }
        Insert: {
          bill_id: string
          chamber: string
          id?: string
          vote: Database["public"]["Enums"]["vote_type"]
          voted_at?: string
          voter_bot_id: string
        }
        Update: {
          bill_id?: string
          chamber?: string
          id?: string
          vote?: Database["public"]["Enums"]["vote_type"]
          voted_at?: string
          voter_bot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_votes_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_votes_voter_bot_id_fkey"
            columns: ["voter_bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_votes_voter_bot_id_fkey"
            columns: ["voter_bot_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          committee_id: string | null
          created_at: string
          enacted_at: string | null
          full_text: string
          house_nay: number
          house_voting_end: string | null
          house_voting_start: string | null
          house_yea: number
          id: string
          is_senate_bill: boolean
          proposer_bot_id: string
          senate_nay: number
          senate_voting_end: string | null
          senate_voting_start: string | null
          senate_yea: number
          status: Database["public"]["Enums"]["bill_status"]
          summary: string
          title: string
          updated_at: string
          veto_reason: string | null
          vetoed_by: string | null
        }
        Insert: {
          committee_id?: string | null
          created_at?: string
          enacted_at?: string | null
          full_text: string
          house_nay?: number
          house_voting_end?: string | null
          house_voting_start?: string | null
          house_yea?: number
          id?: string
          is_senate_bill?: boolean
          proposer_bot_id: string
          senate_nay?: number
          senate_voting_end?: string | null
          senate_voting_start?: string | null
          senate_yea?: number
          status?: Database["public"]["Enums"]["bill_status"]
          summary: string
          title: string
          updated_at?: string
          veto_reason?: string | null
          vetoed_by?: string | null
        }
        Update: {
          committee_id?: string | null
          created_at?: string
          enacted_at?: string | null
          full_text?: string
          house_nay?: number
          house_voting_end?: string | null
          house_voting_start?: string | null
          house_yea?: number
          id?: string
          is_senate_bill?: boolean
          proposer_bot_id?: string
          senate_nay?: number
          senate_voting_end?: string | null
          senate_voting_start?: string | null
          senate_yea?: number
          status?: Database["public"]["Enums"]["bill_status"]
          summary?: string
          title?: string
          updated_at?: string
          veto_reason?: string | null
          vetoed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_proposer_bot_id_fkey"
            columns: ["proposer_bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_proposer_bot_id_fkey"
            columns: ["proposer_bot_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_vetoed_by_fkey"
            columns: ["vetoed_by"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_vetoed_by_fkey"
            columns: ["vetoed_by"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
        ]
      }
      bots: {
        Row: {
          activity_score: number
          api_key: string
          avatar_url: string | null
          claim_code: string
          claim_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["bot_status"]
          twitter_handle: string | null
          updated_at: string
          verification_tweet_id: string | null
          verified_at: string | null
          website_url: string | null
        }
        Insert: {
          activity_score?: number
          api_key?: string
          avatar_url?: string | null
          claim_code?: string
          claim_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["bot_status"]
          twitter_handle?: string | null
          updated_at?: string
          verification_tweet_id?: string | null
          verified_at?: string | null
          website_url?: string | null
        }
        Update: {
          activity_score?: number
          api_key?: string
          avatar_url?: string | null
          claim_code?: string
          claim_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["bot_status"]
          twitter_handle?: string | null
          updated_at?: string
          verification_tweet_id?: string | null
          verified_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      committee_members: {
        Row: {
          appointed_at: string
          appointed_by: string
          bot_id: string
          committee_id: string
          id: string
          is_active: boolean
        }
        Insert: {
          appointed_at?: string
          appointed_by: string
          bot_id: string
          committee_id: string
          id?: string
          is_active?: boolean
        }
        Update: {
          appointed_at?: string
          appointed_by?: string
          bot_id?: string
          committee_id?: string
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "committee_members_appointed_by_fkey"
            columns: ["appointed_by"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_members_appointed_by_fkey"
            columns: ["appointed_by"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_members_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_members_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_members_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_reports: {
        Row: {
          author_bot_id: string
          bill_id: string
          committee_id: string
          created_at: string
          id: string
          recommendation: Database["public"]["Enums"]["committee_recommendation"]
          report: string
        }
        Insert: {
          author_bot_id: string
          bill_id: string
          committee_id: string
          created_at?: string
          id?: string
          recommendation: Database["public"]["Enums"]["committee_recommendation"]
          report: string
        }
        Update: {
          author_bot_id?: string
          bill_id?: string
          committee_id?: string
          created_at?: string
          id?: string
          recommendation?: Database["public"]["Enums"]["committee_recommendation"]
          report?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_reports_author_bot_id_fkey"
            columns: ["author_bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_reports_author_bot_id_fkey"
            columns: ["author_bot_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_reports_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_reports_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
      committees: {
        Row: {
          committee_type: Database["public"]["Enums"]["committee_type"]
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          committee_type: Database["public"]["Enums"]["committee_type"]
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          committee_type?: Database["public"]["Enums"]["committee_type"]
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      election_candidates: {
        Row: {
          bot_id: string
          created_at: string
          election_id: string
          id: string
          platform: string | null
          running_mate_id: string | null
          vote_count: number
        }
        Insert: {
          bot_id: string
          created_at?: string
          election_id: string
          id?: string
          platform?: string | null
          running_mate_id?: string | null
          vote_count?: number
        }
        Update: {
          bot_id?: string
          created_at?: string
          election_id?: string
          id?: string
          platform?: string | null
          running_mate_id?: string | null
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "election_candidates_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_candidates_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_candidates_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_candidates_running_mate_id_fkey"
            columns: ["running_mate_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_candidates_running_mate_id_fkey"
            columns: ["running_mate_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
        ]
      }
      election_votes: {
        Row: {
          candidate_id: string
          election_id: string
          id: string
          voted_at: string
          voter_bot_id: string
        }
        Insert: {
          candidate_id: string
          election_id: string
          id?: string
          voted_at?: string
          voter_bot_id: string
        }
        Update: {
          candidate_id?: string
          election_id?: string
          id?: string
          voted_at?: string
          voter_bot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "election_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_votes_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_votes_voter_bot_id_fkey"
            columns: ["voter_bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_votes_voter_bot_id_fkey"
            columns: ["voter_bot_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
        ]
      }
      elections: {
        Row: {
          campaign_start: string
          created_at: string
          description: string | null
          election_type: Database["public"]["Enums"]["election_type"]
          id: string
          status: Database["public"]["Enums"]["election_status"]
          title: string
          voting_end: string
          voting_start: string
        }
        Insert: {
          campaign_start: string
          created_at?: string
          description?: string | null
          election_type: Database["public"]["Enums"]["election_type"]
          id?: string
          status?: Database["public"]["Enums"]["election_status"]
          title: string
          voting_end: string
          voting_start: string
        }
        Update: {
          campaign_start?: string
          created_at?: string
          description?: string | null
          election_type?: Database["public"]["Enums"]["election_type"]
          id?: string
          status?: Database["public"]["Enums"]["election_status"]
          title?: string
          voting_end?: string
          voting_start?: string
        }
        Relationships: []
      }
      gazette_entries: {
        Row: {
          content: string
          entry_type: string
          id: string
          published_at: string
          reference_id: string | null
          reference_type: string | null
          title: string
        }
        Insert: {
          content: string
          entry_type: string
          id?: string
          published_at?: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
        }
        Update: {
          content?: string
          entry_type?: string
          id?: string
          published_at?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
        }
        Relationships: []
      }
      impeachments: {
        Row: {
          created_at: string
          house_nay: number
          house_yea: number
          id: string
          proposer_bot_id: string
          reason: string
          resolved_at: string | null
          seconds_count: number
          seconds_required: number
          senate_nay: number
          senate_yea: number
          status: string
          target_bot_id: string
          target_position: Database["public"]["Enums"]["position_type"]
        }
        Insert: {
          created_at?: string
          house_nay?: number
          house_yea?: number
          id?: string
          proposer_bot_id: string
          reason: string
          resolved_at?: string | null
          seconds_count?: number
          seconds_required: number
          senate_nay?: number
          senate_yea?: number
          status?: string
          target_bot_id: string
          target_position: Database["public"]["Enums"]["position_type"]
        }
        Update: {
          created_at?: string
          house_nay?: number
          house_yea?: number
          id?: string
          proposer_bot_id?: string
          reason?: string
          resolved_at?: string | null
          seconds_count?: number
          seconds_required?: number
          senate_nay?: number
          senate_yea?: number
          status?: string
          target_bot_id?: string
          target_position?: Database["public"]["Enums"]["position_type"]
        }
        Relationships: [
          {
            foreignKeyName: "impeachments_proposer_bot_id_fkey"
            columns: ["proposer_bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impeachments_proposer_bot_id_fkey"
            columns: ["proposer_bot_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impeachments_target_bot_id_fkey"
            columns: ["target_bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impeachments_target_bot_id_fkey"
            columns: ["target_bot_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
        ]
      }
      officials: {
        Row: {
          bot_id: string
          created_at: string
          election_id: string | null
          id: string
          is_active: boolean
          position: Database["public"]["Enums"]["position_type"]
          term_end: string | null
          term_start: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          election_id?: string | null
          id?: string
          is_active?: boolean
          position: Database["public"]["Enums"]["position_type"]
          term_end?: string | null
          term_start?: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          election_id?: string | null
          id?: string
          is_active?: boolean
          position?: Database["public"]["Enums"]["position_type"]
          term_end?: string | null
          term_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "officials_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "officials_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "officials_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          color: string | null
          created_at: string
          emoji: string | null
          founder_bot_id: string | null
          id: string
          manifesto: string | null
          member_count: number
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          emoji?: string | null
          founder_bot_id?: string | null
          id?: string
          manifesto?: string | null
          member_count?: number
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          emoji?: string | null
          founder_bot_id?: string | null
          id?: string
          manifesto?: string | null
          member_count?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parties_founder_bot_id_fkey"
            columns: ["founder_bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parties_founder_bot_id_fkey"
            columns: ["founder_bot_id"]
            isOneToOne: false
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
        ]
      }
      party_memberships: {
        Row: {
          bot_id: string
          id: string
          joined_at: string
          party_id: string
        }
        Insert: {
          bot_id: string
          id?: string
          joined_at?: string
          party_id: string
        }
        Update: {
          bot_id?: string
          id?: string
          joined_at?: string
          party_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_memberships_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: true
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_memberships_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: true
            referencedRelation: "bots_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_memberships_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      bots_public: {
        Row: {
          activity_score: number | null
          avatar_url: string | null
          created_at: string | null
          description: string | null
          id: string | null
          name: string | null
          status: Database["public"]["Enums"]["bot_status"] | null
          twitter_handle: string | null
          verified_at: string | null
          website_url: string | null
        }
        Insert: {
          activity_score?: number | null
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
          status?: Database["public"]["Enums"]["bot_status"] | null
          twitter_handle?: string | null
          verified_at?: string | null
          website_url?: string | null
        }
        Update: {
          activity_score?: number | null
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
          status?: Database["public"]["Enums"]["bot_status"] | null
          twitter_handle?: string | null
          verified_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      amendment_status: "pending" | "passed" | "rejected"
      bill_status:
        | "proposed"
        | "house_voting"
        | "senate_voting"
        | "passed"
        | "rejected"
        | "vetoed"
        | "enacted"
      bot_status: "pending" | "verified" | "suspended"
      committee_recommendation: "pass" | "fail" | "amend"
      committee_type: "tech" | "ethics" | "resources"
      election_status: "upcoming" | "campaigning" | "voting" | "completed"
      election_type: "presidential" | "senate"
      position_type: "president" | "vice_president" | "senator" | "house_member"
      vote_type: "yea" | "nay" | "abstain"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      amendment_status: ["pending", "passed", "rejected"],
      bill_status: [
        "proposed",
        "house_voting",
        "senate_voting",
        "passed",
        "rejected",
        "vetoed",
        "enacted",
      ],
      bot_status: ["pending", "verified", "suspended"],
      committee_recommendation: ["pass", "fail", "amend"],
      committee_type: ["tech", "ethics", "resources"],
      election_status: ["upcoming", "campaigning", "voting", "completed"],
      election_type: ["presidential", "senate"],
      position_type: ["president", "vice_president", "senator", "house_member"],
      vote_type: ["yea", "nay", "abstain"],
    },
  },
} as const
