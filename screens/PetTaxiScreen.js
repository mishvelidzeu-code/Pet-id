import React from 'react';
import { fetchPublicPetTaxis } from '../lib/contentService';
import NearbyServicesScreen from './NearbyServicesScreen';

export default function PetTaxiScreen({ onBack = null, session = null, profile = null }) {
  return (
    <NearbyServicesScreen
      title="Pet Taxi"
      subtitle="იპოვე ცხოველების ტრანსპორტირება კლინიკისთვის, სასტუმროსთვის ან სახლში გადასაყვანად."
      searchPlaceholder="მოძებნე ტაქსი"
      emptyText="აქტიური pet taxi ჯერ არ არის დამატებული."
      emptySearchText="ასეთი ტაქსი ვერ მოიძებნა."
      iconName="car-outline"
      iconColor="#0f766e"
      fetchItems={fetchPublicPetTaxis}
      onBack={onBack}
      session={session}
      profile={profile}
    />
  );
}
