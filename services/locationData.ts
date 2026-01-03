
// Base de dados expandida (~400 cidades principais)
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
  "Itajaí - SC", "Rio Grande - RS", "Rio Verde - GO", "Boa Vista - RR", "Palmas - TO",
  "Balneário Camboriú - SC", "Gramado - RS", "Campos do Jordão - SP", "Ouro Preto - MG",
  "Paraty - RJ", "Búzios - RJ", "Ilhabela - SP", "Porto Seguro - BA", "Jericoacoara - CE",
  "Juiz de Fora - MG", "Macapá - AP", "Anápolis - GO", "Caxias - MA", "Sobral - CE",
  "Rio Claro - SP", "Araçatuba - SP", "Santa Bárbara d'Oeste - SP", "Ferraz de Vasconcelos - SP",
  "Ilhéus - BA", "Araguaína - TO", "Luziânia - GO", "Castanhal - PA", "Angra dos Reis - RJ",
  "Trindade - GO", "Cachoeiro de Itapemirim - ES", "Passo Fundo - RS", "Sinop - MT",
  "Guarapuava - PR", "Jaraguá do Sul - SC", "Resende - RJ", "Itapetininga - SP",
  "Itapecerica da Serra - SP", "Alvorada - RS", "Marituba - PA", "Parnaíba - PI",
  "Cabo de Santo Agostinho - PE", "Abaetetuba - PA", "Camaragibe - PE", "Sertãozinho - SP",
  "Valinhos - SP", "Barretos - SP", "Araras - SP", "Pindamonhangaba - SP", "Mogi Guaçu - SP",
  "Itabuna - BA", "Linhares - ES", "São Caetano do Sul - SP", "Bragança Paulista - SP",
  "Birigui - SP", "Catanduva - SP", "Barbacena - MG", "Teresópolis - RJ", "Varginha - MG",
  "Conselheiro Lafaiete - MG", "Poços de Caldas - MG", "Ibirité - MG", "Araruama - RJ",
  "Barra Mansa - RJ", "Macaé - RJ", "Queimados - RJ", "Nilópolis - RJ", "Mesquita - RJ",
  "Jequié - BA", "Alagoinhas - BA", "Barreiras - BA", "Teixeira de Freitas - BA",
  "Patos - PB", "Crato - CE", "Itapipoca - CE", "Timon - MA", "São José de Ribamar - MA",
  "Dourados - MS", "Três Lagoas - MS", "Corumbá - MS", "Ji-Paraná - RO", "Ariquemes - RO",
  "Vilhena - RO", "Parintins - AM", "Itacoatiara - AM", "Manacapuru - AM", "Santana - AP",
  "Laranjal do Jari - AP", "Gurupi - TO", "Araguatins - TO", "Paraíso do Tocantins - TO",
  "Pato Branco - PR", "Toledo - PR", "Apucarana - PR", "Pinhais - PR", "Araucária - PR",
  "Campo Largo - PR", "Umuarama - PR", "Paranaguá - PR", "Criciúma - SC", "Lages - SC",
  "Palhoça - SC", "Brusque - SC", "Tubarão - SC", "São Bento do Sul - SC", "Caçador - SC",
  "Concórdia - SC", "Bagé - RS", "Uruguaiana - RS", "Bento Gonçalves - RS", "Erechim - RS",
  "Santa Cruz do Sul - RS", "Cachoeirinha - RS", "Sapucaia do Sul - RS", "Lajeado - RS"
];

// Algoritmo de busca otimizado
export const searchCities = (query: string): string[] => {
    if (!query || query.length < 2) return [];

    const normalizedQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Filtra e classifica
    const matches = BRAZIL_CITIES.map(city => {
        const normalizedCity = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let score = 0;

        if (normalizedCity === normalizedQuery) score = 100; // Match exato
        else if (normalizedCity.startsWith(normalizedQuery)) score = 50; // Começa com
        else if (normalizedCity.includes(normalizedQuery)) score = 10; // Contém
        
        return { city, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score) 
    .map(item => item.city)
    .slice(0, 10); // Aumentado para 10 sugestões

    return matches;
};

// Coordenadas das capitais e principais cidades (Fallback rápido)
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
    "Belém - PA": { lat: -1.4558, lng: -48.4902 },
    "Goiânia - GO": { lat: -16.6869, lng: -49.2648 },
    "Florianópolis - SC": { lat: -27.5954, lng: -48.5480 },
    "Vitória - ES": { lat: -20.3155, lng: -40.3128 },
    "Natal - RN": { lat: -5.7945, lng: -35.2110 },
    "Campo Grande - MS": { lat: -20.4697, lng: -54.6201 },
    "Cuiabá - MT": { lat: -15.6014, lng: -56.0979 },
    "João Pessoa - PB": { lat: -7.1195, lng: -34.8450 },
    "Maceió - AL": { lat: -9.6662, lng: -35.7351 },
    "São Luís - MA": { lat: -2.5307, lng: -44.3068 },
    "Teresina - PI": { lat: -5.0919, lng: -42.8034 },
    "Aracaju - SE": { lat: -10.9472, lng: -37.0731 },
    "Palmas - TO": { lat: -10.2128, lng: -48.3603 },
    "Porto Velho - RO": { lat: -8.7619, lng: -63.9039 },
    "Boa Vista - RR": { lat: 2.8235, lng: -60.6758 },
    "Rio Branco - AC": { lat: -9.9754, lng: -67.8249 },
    "Macapá - AP": { lat: 0.0355, lng: -51.0705 }
};

export const getCityCoordinates = async (cityName: string): Promise<{latitude: number, longitude: number} | null> => {
    // 1. Tenta pegar do mapa estático
    if (CITY_COORDS[cityName]) {
        return { latitude: CITY_COORDS[cityName].lat, longitude: CITY_COORDS[cityName].lng };
    }
    
    // 2. Fallback Nominatim (OpenStreetMap)
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
