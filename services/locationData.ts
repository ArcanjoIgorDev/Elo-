
// Base de dados local otimizada para busca de cidades
// Em um app real, isso poderia ser um JSON de 200kb carregado sob demanda ou uma tabela no Supabase.
// Aqui colocaremos as principais capitais e algumas cidades para exemplo do algoritmo determinístico.

const BRAZIL_CITIES = [
  "São Paulo - SP", "Rio de Janeiro - RJ", "Belo Horizonte - MG", "Brasília - DF",
  "Salvador - BA", "Fortaleza - CE", "Curitiba - PR", "Manaus - AM", "Recife - PE",
  "Porto Alegre - RS", "Goiânia - GO", "Belém - PA", "Guarulhos - SP", "Campinas - SP",
  "São Luís - MA", "São Gonçalo - RJ", "Maceió - AL", "Duque de Caxias - RJ",
  "Natal - RN", "Teresina - PI", "São Bernardo do Campo - SP", "Campo Grande - MS",
  "Osasco - SP", "Santo André - SP", "João Pessoa - PB", "Jaboatão dos Guararapes - PE",
  "São José dos Campos - SP", "Uberlândia - MG", "Contagem - MG", "Sorocaba - SP",
  "Ribeirão Preto - SP", "Cuiabá - MT", "Feira de Santana - BA", "Aracaju - SE",
  "Joinville - SC", "Londrina - PR", "Niterói - RJ", "Aparecida de Goiânia - GO",
  "Ananindeua - PA", "Porto Velho - RO", "Florianópolis - SC", "Mauá - SP",
  "Serra - ES", "Caxias do Sul - RS", "Vila Velha - ES", "Nova Iguaçu - RJ",
  "São José do Rio Preto - SP", "Mogi das Cruzes - SP", "Macapá - AP", "Santos - SP",
  "Diadema - SP", "Betim - MG", "Campina Grande - PB", "Jundiaí - SP",
  "Maringá - PR", "Montes Claros - MG", "Piracicaba - SP", "Carapicuíba - SP",
  "Olinda - PE", "Cariacica - ES", "Rio Branco - AC", "Bauru - SP", "Itaquaquecetuba - SP",
  "São Vicente - SP", "Vitória - ES", "Caruaru - PE", "Caucaia - CE", "Blumenau - SC",
  "Franca - SP", "Ponta Grossa - PR", "Petrolina - PE", "Canoas - RS", "Pelotas - RS",
  "Vitória da Conquista - BA", "Ribeirão das Neves - MG", "Paulista - PE", "Uberaba - MG",
  "Cascavel - PR", "Guarujá - SP", "Taubaté - SP", "Limeira - SP", "Santarém - PA",
  "Petrópolis - RJ", "Mossoró - RN", "Camaçari - BA", "Suzano - SP", "Taboão da Serra - SP",
  "Várzea Grande - MT", "Sumaré - SP", "Santa Maria - RS", "Gravataí - RS", "Marabá - PA",
  "Governador Valadares - MG", "Barueri - SP", "Embu das Artes - SP", "Juazeiro do Norte - CE",
  "Volta Redonda - RJ", "Ipatinga - MG", "Parnamirim - RN", "Imperatriz - MA", "Foz do Iguaçu - PR",
  "Viamão - RS", "Indaiatuba - SP", "São Carlos - SP", "Cotia - SP", "São José - SC",
  "Novo Hamburgo - RS", "Colombo - PR", "Magé - RJ", "Itaboraí - RJ", "Americana - SP",
  "Itapevi - SP", "Sete Lagoas - MG", "Divinópolis - MG", "Marília - SP", "Araraquara - SP",
  "São Leopoldo - RS", "Rondonópolis - MT", "Hortolândia - SP", "Jacareí - SP", "Presidente Prudente - SP",
  "Arapiraca - AL", "Cabo Frio - RJ", "Maracanaú - CE", "Dourados - MS", "Chapecó - SC",
  "Itajaí - SC", "Rio Grande - RS", "Rio Verde - GO"
];

// Algoritmo determinístico de busca
export const searchCities = (query: string): string[] => {
    const normalizedQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    return BRAZIL_CITIES.filter(city => {
        const normalizedCity = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return normalizedCity.includes(normalizedQuery);
    }).slice(0, 5); // Retorna top 5
};

// Mock de coordenadas para algumas capitais (para o mapa funcionar sem API externa)
// Em produção, isso seria uma tabela no Supabase com lat/lng de todas as cidades
const CITY_COORDS: Record<string, {lat: number, lng: number}> = {
    "São Paulo - SP": { lat: -23.5505, lng: -46.6333 },
    "Rio de Janeiro - RJ": { lat: -22.9068, lng: -43.1729 },
    "Brasília - DF": { lat: -15.7801, lng: -47.9292 },
    "Salvador - BA": { lat: -12.9777, lng: -38.5016 },
    "Belo Horizonte - MG": { lat: -19.9167, lng: -43.9345 },
    "Curitiba - PR": { lat: -25.4284, lng: -49.2733 },
    "Manaus - AM": { lat: -3.1190, lng: -60.0217 },
    "Recife - PE": { lat: -8.0476, lng: -34.8770 },
    "Porto Alegre - RS": { lat: -30.0346, lng: -51.2177 },
    "Fortaleza - CE": { lat: -3.7172, lng: -38.5434 },
};

export const getCityCoordinates = async (cityName: string): Promise<{latitude: number, longitude: number} | null> => {
    // 1. Tenta pegar do mapa estático
    if (CITY_COORDS[cityName]) {
        return { latitude: CITY_COORDS[cityName].lat, longitude: CITY_COORDS[cityName].lng };
    }
    
    // 2. Se não achar, usa um fallback genérico ou uma API pública gratuita (OpenStreetMap Nominatim)
    // Para manter "sem API Key", usamos Nominatim que é open source e free (com rate limit)
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}, Brazil`);
        const data = await response.json();
        if (data && data.length > 0) {
            return {
                latitude: parseFloat(data[0].lat),
                longitude: parseFloat(data[0].lon)
            };
        }
    } catch (e) {
        console.error("Erro ao buscar coordenadas:", e);
    }

    return null;
};
