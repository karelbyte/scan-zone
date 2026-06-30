/**
 * Catálogo geográfico de México: Estados y Municipios principales.
 * 
 * Fuente: Basado en el catálogo del INEGI (Instituto Nacional de Estadística y Geografía).
 * Se incluyen los municipios con mayor actividad económica y comercial por estado.
 * 
 * Estructura:
 * - Cada estado tiene un array de municipios ordenados por relevancia comercial.
 * - El agente itera estado por estado, municipio por municipio.
 */

export const GEO_DATA = {
  'Aguascalientes': [
    'Aguascalientes', 'Jesús María', 'Calvillo', 'Rincón de Romos', 'Pabellón de Arteaga',
    'San Francisco de los Romo', 'Asientos', 'Cosío', 'Tepezalá', 'El Llano', 'San José de Gracia'
  ],
  'Baja California': [
    'Tijuana', 'Mexicali', 'Ensenada', 'Tecate', 'Playas de Rosarito', 'San Quintín', 'San Felipe'
  ],
  'Baja California Sur': [
    'La Paz', 'Los Cabos', 'Comondú', 'Mulegé', 'Loreto'
  ],
  'Campeche': [
    'Campeche', 'Ciudad del Carmen', 'Champotón', 'Escárcega', 'Calkiní',
    'Hecelchakán', 'Hopelchén', 'Candelaria', 'Tenabo', 'Palizada', 'Calakmul'
  ],
  'Chiapas': [
    'Tuxtla Gutiérrez', 'San Cristóbal de las Casas', 'Tapachula', 'Comitán de Domínguez',
    'Palenque', 'Chiapa de Corzo', 'Tonalá', 'Villaflores', 'Ocosingo', 'Pichucalco',
    'Cintalapa', 'Huixtla', 'Motozintla', 'San Fernando', 'Reforma',
    'Arriaga', 'Berriozábal', 'Jiquipilas', 'Venustiano Carranza', 'Las Margaritas'
  ],
  'Chihuahua': [
    'Chihuahua', 'Ciudad Juárez', 'Delicias', 'Cuauhtémoc', 'Parral',
    'Nuevo Casas Grandes', 'Camargo', 'Jiménez', 'Ojinaga', 'Meoqui',
    'Madera', 'Guachochi', 'Saucillo', 'Aldama', 'Namiquipa'
  ],
  'Ciudad de México': [
    'Álvaro Obregón', 'Azcapotzalco', 'Benito Juárez', 'Coyoacán', 'Cuajimalpa de Morelos',
    'Cuauhtémoc', 'Gustavo A. Madero', 'Iztacalco', 'Iztapalapa', 'Magdalena Contreras',
    'Miguel Hidalgo', 'Milpa Alta', 'Tláhuac', 'Tlalpan', 'Venustiano Carranza', 'Xochimilco'
  ],
  'Coahuila': [
    'Saltillo', 'Torreón', 'Monclova', 'Piedras Negras', 'Acuña',
    'Sabinas', 'Ramos Arizpe', 'San Pedro', 'Frontera', 'Múzquiz',
    'Parras', 'Nueva Rosita', 'Allende', 'Castaños', 'Matamoros'
  ],
  'Colima': [
    'Colima', 'Manzanillo', 'Tecomán', 'Villa de Álvarez', 'Armería',
    'Comala', 'Coquimatlán', 'Cuauhtémoc', 'Ixtlahuacán', 'Minatitlán'
  ],
  'Durango': [
    'Durango', 'Gómez Palacio', 'Lerdo', 'Santiago Papasquiaro', 'Canatlán',
    'Nuevo Ideal', 'Guadalupe Victoria', 'Poanas', 'Nombre de Dios', 'El Oro',
    'Vicente Guerrero', 'Pueblo Nuevo', 'Mapimí', 'Cuencamé', 'Tamazula'
  ],
  'Estado de México': [
    'Toluca', 'Ecatepec', 'Naucalpan', 'Tlalnepantla', 'Nezahualcóyotl',
    'Atizapán de Zaragoza', 'Cuautitlán Izcalli', 'Huixquilucan', 'Metepec', 'Coacalco',
    'Texcoco', 'Chalco', 'Ixtapaluca', 'Tultitlán', 'Nicolás Romero',
    'Chimalhuacán', 'Valle de Bravo', 'Zinacantepec', 'Tenancingo', 'Lerma',
    'Tecámac', 'Zumpango', 'Ixtapan de la Sal', 'Atlacomulco', 'Jilotepec'
  ],
  'Guanajuato': [
    'León', 'Irapuato', 'Celaya', 'Salamanca', 'Guanajuato',
    'San Miguel de Allende', 'Silao', 'Dolores Hidalgo', 'San Francisco del Rincón', 'Pénjamo',
    'Acámbaro', 'Salvatierra', 'Valle de Santiago', 'Cortazar', 'Abasolo',
    'Yuriria', 'Moroleón', 'Uriangato', 'San José Iturbide', 'Apaseo el Grande'
  ],
  'Guerrero': [
    'Acapulco', 'Chilpancingo', 'Iguala', 'Zihuatanejo', 'Taxco',
    'Chilapa', 'Tlapa', 'Coyuca de Benítez', 'Ayutla', 'Tecpan de Galeana',
    'Ometepec', 'Cruz Grande', 'Petatlán', 'Atoyac de Álvarez', 'Arcelia'
  ],
  'Hidalgo': [
    'Pachuca', 'Tulancingo', 'Tula de Allende', 'Huejutla', 'Ixmiquilpan',
    'Actopan', 'Tepeji del Río', 'Tizayuca', 'Mineral de la Reforma', 'Apan',
    'Zimapán', 'Mixquiahuala', 'Tepeapulco', 'Atotonilco de Tula', 'Zacualtipán'
  ],
  'Jalisco': [
    'Guadalajara', 'Zapopan', 'Tlaquepaque', 'Tonalá', 'Tlajomulco de Zúñiga',
    'Puerto Vallarta', 'Lagos de Moreno', 'Tepatitlán', 'Ocotlán', 'Chapala',
    'Arandas', 'Autlán', 'Ciudad Guzmán', 'La Barca', 'Ameca',
    'Tequila', 'Tamazula', 'Jocotepec', 'El Salto', 'Colotlán'
  ],
  'Michoacán': [
    'Morelia', 'Uruapan', 'Zamora', 'Lázaro Cárdenas', 'Apatzingán',
    'Hidalgo', 'Zitácuaro', 'Pátzcuaro', 'Sahuayo', 'Jacona',
    'La Piedad', 'Maravatío', 'Los Reyes', 'Jiquilpan', 'Tacámbaro',
    'Puruándiro', 'Paracho', 'Coalcomán', 'Huetamo', 'Zinapécuaro'
  ],
  'Morelos': [
    'Cuernavaca', 'Jiutepec', 'Cuautla', 'Temixco', 'Yautepec',
    'Emiliano Zapata', 'Xochitepec', 'Jojutla', 'Puente de Ixtla', 'Zacatepec',
    'Ayala', 'Tlaltizapán', 'Tepoztlán', 'Ocuituco', 'Axochiapan'
  ],
  'Nayarit': [
    'Tepic', 'Bahía de Banderas', 'Santiago Ixcuintla', 'Compostela', 'Xalisco',
    'Tuxpan', 'Ixtlán del Río', 'Tecuala', 'Acaponeta', 'San Blas',
    'Ahuacatlán', 'Jala', 'Santa María del Oro'
  ],
  'Nuevo León': [
    'Monterrey', 'Guadalupe', 'San Nicolás de los Garza', 'Apodaca', 'Santa Catarina',
    'General Escobedo', 'San Pedro Garza García', 'Juárez', 'García', 'Cadereyta Jiménez',
    'Linares', 'Montemorelos', 'Santiago', 'Allende', 'Ciénega de Flores',
    'Salinas Victoria', 'Pesquería', 'General Zuazua', 'Cerralvo', 'Sabinas Hidalgo'
  ],
  'Oaxaca': [
    'Oaxaca de Juárez', 'Salina Cruz', 'Juchitán', 'Tuxtepec', 'Huatulco',
    'Puerto Escondido', 'Huajuapan de León', 'Tehuantepec', 'Miahuatlán', 'Pinotepa Nacional',
    'Matías Romero', 'Ixtepec', 'Tlaxiaco', 'Ocotlán de Morelos', 'Zimatlán',
    'Tlacolula', 'Etla', 'Putla Villa de Guerrero', 'Loma Bonita', 'Pochutla'
  ],
  'Puebla': [
    'Puebla', 'Tehuacán', 'San Martín Texmelucan', 'Atlixco', 'Cholula',
    'San Pedro Cholula', 'Amozoc', 'Huauchinango', 'Izúcar de Matamoros', 'Teziutlán',
    'Zacatlán', 'Acatzingo', 'Tecamachalco', 'Chignahuapan', 'Libres',
    'Xicotepec', 'Oriental', 'Huejotzingo', 'Cuautlancingo', 'San Andrés Cholula'
  ],
  'Querétaro': [
    'Querétaro', 'San Juan del Río', 'El Marqués', 'Corregidora', 'Pedro Escobedo',
    'Tequisquiapan', 'Cadereyta', 'Jalpan de Serra', 'Ezequiel Montes', 'Colón',
    'Amealco', 'Huimilpan', 'San Joaquín'
  ],
  'Quintana Roo': [
    'Cancún', 'Playa del Carmen', 'Chetumal', 'Cozumel', 'Tulum',
    'Felipe Carrillo Puerto', 'Isla Mujeres', 'Bacalar', 'José María Morelos', 'Lázaro Cárdenas'
  ],
  'San Luis Potosí': [
    'San Luis Potosí', 'Soledad de Graciano Sánchez', 'Ciudad Valles', 'Matehuala', 'Rioverde',
    'Tamazunchale', 'Cerritos', 'Cárdenas', 'Tamasopo', 'Ébano',
    'Xilitla', 'Aquismón', 'Tancanhuitz', 'Charcas', 'Salinas'
  ],
  'Sinaloa': [
    'Culiacán', 'Mazatlán', 'Los Mochis', 'Guasave', 'Navolato',
    'Guamúchil', 'Escuinapa', 'El Rosario', 'Concordia', 'Cosalá',
    'Angostura', 'Mocorito', 'Badiraguato', 'Elota', 'Choix'
  ],
  'Sonora': [
    'Hermosillo', 'Ciudad Obregón', 'Nogales', 'San Luis Río Colorado', 'Navojoa',
    'Guaymas', 'Agua Prieta', 'Caborca', 'Puerto Peñasco', 'Empalme',
    'Magdalena', 'Cananea', 'Huatabampo', 'Álamos', 'Etchojoa'
  ],
  'Tabasco': [
    'Villahermosa', 'Cárdenas', 'Comalcalco', 'Paraíso', 'Huimanguillo',
    'Macuspana', 'Cunduacán', 'Teapa', 'Jalpa de Méndez', 'Nacajuca',
    'Centla', 'Balancán', 'Tenosique', 'Jonuta', 'Emiliano Zapata', 'Tacotalpa', 'Jalapa'
  ],
  'Tamaulipas': [
    'Reynosa', 'Tampico', 'Matamoros', 'Nuevo Laredo', 'Ciudad Victoria',
    'Ciudad Madero', 'Altamira', 'Río Bravo', 'El Mante', 'Valle Hermoso',
    'Miguel Alemán', 'Tula', 'González', 'Xicoténcatl', 'San Fernando'
  ],
  'Tlaxcala': [
    'Tlaxcala', 'Apizaco', 'Huamantla', 'San Pablo del Monte', 'Chiautempan',
    'Calpulalpan', 'Zacatelco', 'Contla', 'Tlaxco', 'Panotla',
    'Ixtacuixtla', 'Nativitas', 'Tetla', 'Teolocholco', 'Xicohtzinco'
  ],
  'Veracruz': [
    'Veracruz', 'Xalapa', 'Coatzacoalcos', 'Córdoba', 'Poza Rica',
    'Boca del Río', 'Orizaba', 'Minatitlán', 'Tuxpan', 'Papantla',
    'Martínez de la Torre', 'San Andrés Tuxtla', 'Tierra Blanca', 'Cosamaloapan', 'Fortín',
    'Acayucan', 'Álamo Temapache', 'Coatepec', 'Perote', 'Las Choapas'
  ],
  'Yucatán': [
    'Mérida', 'Valladolid', 'Tizimín', 'Progreso', 'Kanasín',
    'Umán', 'Tekax', 'Motul', 'Ticul', 'Izamal',
    'Maxcanú', 'Oxkutzcab', 'Hunucmá', 'Conkal', 'Acanceh'
  ],
  'Zacatecas': [
    'Zacatecas', 'Fresnillo', 'Guadalupe', 'Jerez', 'Río Grande',
    'Sombrerete', 'Loreto', 'Calera', 'Ojocaliente', 'Jalpa',
    'Villanueva', 'Nochistlán', 'Juan Aldama', 'Tlaltenango', 'Valparaíso'
  ]
};

/**
 * Devuelve la lista de todos los estados.
 */
export function getStates() {
  return Object.keys(GEO_DATA);
}

/**
 * Devuelve los municipios de un estado dado.
 */
export function getMunicipalities(state) {
  return GEO_DATA[state] || [];
}

/**
 * Devuelve el total de combinaciones estado-municipio.
 */
export function getTotalMunicipalities() {
  return Object.values(GEO_DATA).reduce((sum, muns) => sum + muns.length, 0);
}

/**
 * Genera todas las combinaciones (estado, municipio) como lista plana.
 */
export function getAllLocations() {
  const locations = [];
  for (const [state, municipalities] of Object.entries(GEO_DATA)) {
    for (const municipality of municipalities) {
      locations.push({ state, municipality });
    }
  }
  return locations;
}
