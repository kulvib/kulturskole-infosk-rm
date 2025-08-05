"""Add all new fields to client table

Revision ID: 20250805_add_all_client_fields
Revises: 
Create Date: 2025-08-05 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250805_add_all_client_fields'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('client', sa.Column('kiosk_url', sa.String(), nullable=True))
    op.add_column('client', sa.Column('ubuntu_version', sa.String(), nullable=True))
    op.add_column('client', sa.Column('uptime', sa.String(), nullable=True))
    op.add_column('client', sa.Column('wifi_ip_address', sa.String(), nullable=True))
    op.add_column('client', sa.Column('wifi_mac_address', sa.String(), nullable=True))
    op.add_column('client', sa.Column('lan_ip_address', sa.String(), nullable=True))
    op.add_column('client', sa.Column('lan_mac_address', sa.String(), nullable=True))

def downgrade():
    op.drop_column('client', 'kiosk_url')
    op.drop_column('client', 'ubuntu_version')
    op.drop_column('client', 'uptime')
    op.drop_column('client', 'wifi_ip_address')
    op.drop_column('client', 'wifi_mac_address')
    op.drop_column('client', 'lan_ip_address')
    op.drop_column('client', 'lan_mac_address')
