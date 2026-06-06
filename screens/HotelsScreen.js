import React from 'react';
import { fetchPublicPetHotels } from '../lib/contentService';
import NearbyServicesScreen from './NearbyServicesScreen';

export default function HotelsScreen({ onBack = null, session = null, profile = null }) {
  return (
    <NearbyServicesScreen
      title="სასტუმროები"
      subtitle="იპოვე ცხოველებისთვის განკუთვნილი სასტუმროები და ნახე რომელი მდებარეობს ყველაზე ახლოს."
      searchPlaceholder="მოძებნე სასტუმრო"
      emptyText="აქტიური სასტუმროები ჯერ არ არის დამატებული."
      emptySearchText="ასეთი სასტუმრო ვერ მოიძებნა."
      iconName="bed-outline"
      iconColor="#7c3aed"
      fetchItems={fetchPublicPetHotels}
      onBack={onBack}
      session={session}
      profile={profile}
    />
  );
}
