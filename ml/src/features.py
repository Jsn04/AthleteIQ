import pandas as pd
import numpy as np

def prep_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Sorts the dataframe by athlete_id and date to ensure rolling calculations 
    are done sequentially.
    """
    if 'date' in df.columns:
        df['date'] = pd.to_datetime(df['date'])
    return df.sort_values(by=['athlete_id', 'date']).copy()

def calculate_acute_load(df: pd.DataFrame) -> pd.Series:
    """
    7-day sum of daily session loads per athlete.
    daily_load = RPE * duration.
    """
    df_sorted = prep_data(df)
    return df_sorted.groupby('athlete_id')['session_load'].rolling(window=7, min_periods=1).sum().reset_index(level=0, drop=True)

def calculate_chronic_load(df: pd.DataFrame) -> pd.Series:
    """
    Rolling 28-day average of daily loads per athlete.
    """
    df_sorted = prep_data(df)
    return df_sorted.groupby('athlete_id')['session_load'].rolling(window=28, min_periods=1).mean().reset_index(level=0, drop=True)

def calculate_acwr(df: pd.DataFrame) -> pd.Series:
    """
    Acute-to-Chronic Workload Ratio (ACWR):
    ACWR = 7-day load sum / (rolling 28-day daily average load * 7)
    (or acute_load / (chronic_load * 7))
    """
    df_sorted = prep_data(df)
    acute = calculate_acute_load(df_sorted)
    chronic = calculate_chronic_load(df_sorted)
    
    # Avoid division by zero
    acwr = acute / (chronic * 7)
    return acwr.replace([np.inf, -np.inf], np.nan).fillna(0.0)

def calculate_monotony(df: pd.DataFrame) -> pd.Series:
    """
    Lack of variety in training loads over the last 7 days.
    monotony = mean(daily loads 7d) / std(daily loads 7d)
    """
    df_sorted = prep_data(df)
    
    def calc_group_monotony(group):
        rolling_mean = group['session_load'].rolling(window=7, min_periods=1).mean()
        rolling_std = group['session_load'].rolling(window=7, min_periods=1).std()
        # If std is 0 (or NaN due to single session), monotony is low/1.0
        monotony = rolling_mean / rolling_std
        return monotony.fillna(1.0).replace([np.inf, -np.inf], 1.0)
        
    return df_sorted.groupby('athlete_id', group_keys=False).apply(calc_group_monotony)

def calculate_strain(df: pd.DataFrame) -> pd.Series:
    """
    Combined fatigue signal.
    strain = monotony * sum(daily loads 7d)
    """
    df_sorted = prep_data(df)
    monotony = calculate_monotony(df_sorted)
    acute = calculate_acute_load(df_sorted)
    return monotony * acute

def calculate_load_spike(df: pd.DataFrame) -> pd.Series:
    """
    This week total load / last week total load.
    """
    df_sorted = prep_data(df)
    
    def calc_group_spike(group):
        acute = group['session_load'].rolling(window=7, min_periods=1).sum()
        prev_acute = acute.shift(7)
        spike = acute / prev_acute
        return spike.fillna(1.0).replace([np.inf, -np.inf], 1.0)
        
    return df_sorted.groupby('athlete_id', group_keys=False).apply(calc_group_spike)

def calculate_consecutive_high_days(df: pd.DataFrame, threshold: float = 8.0) -> pd.Series:
    """
    Count of back-to-back high intensity (RPE >= threshold or explicit high flag) sessions.
    """
    df_sorted = prep_data(df)
    
    def calc_group_high_days(group):
        is_high = (group['rpe'] >= threshold).astype(int)
        # Calculate consecutive high days
        consec = is_high.groupby((is_high != is_high.shift()).cumsum()).cumsum()
        # Reset consecutive counts to 0 when it's not a high day
        return consec * is_high

    return df_sorted.groupby('athlete_id', group_keys=False).apply(calc_group_high_days)

def calculate_days_since_rest(df: pd.DataFrame) -> pd.Series:
    """
    Days since last zero-load day.
    """
    df_sorted = prep_data(df)
    
    def calc_group_rest(group):
        is_rest = (group['session_load'] == 0).astype(int)
        # Cumulative sum of rest days. We group by rest occurrences.
        # For rows after a rest day, count days since the last rest day.
        # Alternatively, loop sequentially within group for robustness.
        days_since = []
        counter = 0
        for load in group['session_load']:
            if load == 0:
                counter = 0
            else:
                counter += 1
            days_since.append(counter)
        return pd.Series(days_since, index=group.index)

    return df_sorted.groupby('athlete_id', group_keys=False).apply(calc_group_rest)

def calculate_wellness_trend(df: pd.DataFrame) -> pd.Series:
    """
    7-day rolling average of check-in wellness scores.
    """
    df_sorted = prep_data(df)
    if 'wellness' not in df_sorted.columns:
        # If 'wellness' is not present, check if individual wellness components are present
        # and compute a combined score, or return series of NaNs/zeros.
        if 'wellness_score' in df_sorted.columns:
            target_col = 'wellness_score'
        else:
            return pd.Series(0.0, index=df_sorted.index)
    else:
        target_col = 'wellness'
        
    return df_sorted.groupby('athlete_id')[target_col].rolling(window=7, min_periods=1).mean().reset_index(level=0, drop=True)

def calculate_days_since_last_injury(df: pd.DataFrame) -> pd.Series:
    """
    Days since last injury.
    """
    df_sorted = prep_data(df)
    
    def calc_group_injury(group):
        # Assumes a column 'injured' (boolean/binary 1/0)
        if 'injured' not in group.columns and 'injury' not in group.columns:
            return pd.Series(999, index=group.index) # High default value indicating no recent injury
        
        col = 'injured' if 'injured' in group.columns else 'injury'
        days_since = []
        last_injury_idx = None
        
        # We can calculate calendar days since last injury
        group_dates = group['date'].tolist()
        group_injuries = group[col].tolist()
        
        for idx, (dt, is_inj) in enumerate(zip(group_dates, group_injuries)):
            if is_inj:
                last_injury_idx = idx
            
            if last_injury_idx is None:
                days_since.append(999) # Placeholder for no prior injury in dataset
            else:
                delta = (dt - group_dates[last_injury_idx]).days
                days_since.append(delta)
        return pd.Series(days_since, index=group.index)

    return df_sorted.groupby('athlete_id', group_keys=False).apply(calc_group_injury)

def engineer_all_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculates all engineered features and appends them to the dataframe.
    """
    df_feat = prep_data(df)
    
    # Calculate daily session load if not already present
    if 'session_load' not in df_feat.columns and 'rpe' in df_feat.columns and 'duration' in df_feat.columns:
        df_feat['session_load'] = df_feat['rpe'] * df_feat['duration']
    
    df_feat['acute_load'] = calculate_acute_load(df_feat)
    df_feat['chronic_load'] = calculate_chronic_load(df_feat)
    df_feat['acwr'] = calculate_acwr(df_feat)
    df_feat['monotony'] = calculate_monotony(df_feat)
    df_feat['strain'] = calculate_strain(df_feat)
    df_feat['load_spike'] = calculate_load_spike(df_feat)
    df_feat['consecutive_high_days'] = calculate_consecutive_high_days(df_feat)
    df_feat['days_since_rest'] = calculate_days_since_rest(df_feat)
    df_feat['wellness_trend'] = calculate_wellness_trend(df_feat)
    df_feat['days_since_last_injury'] = calculate_days_since_last_injury(df_feat)
    
    return df_feat
