Data files for the backend

In the repository:
  pois_riyadh_merged.parquet                          places for /services
  reanalysis-era5-land-timeseries-sfc-wind...csv      wind for /wind
  SAU_RI_Riyadh-Khalid.Intl.AP.404370_TMYx.2011-2025.epw
      weather for /facade-indicators (same EPW file as the dataset notebook, from Drive: Mammar)

Not in the repository (too large), made once on each computer:
  gba_riyadh.parquet    GBA buildings around Riyadh for /facade-indicators
      run from the backend folder:  python tools/clip_gba.py
      (or, if you already have the two tiles from Drive: Mammar/GBA,
       python tools/clip_gba.py "path/to/the/GBA/folder")
